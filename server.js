const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// ルームの情報を保存するオブジェクト
let rooms = {};

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 部屋に入る、または新しく作る
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { players: {}, answerLocation: null, gameStarted: false };
        }
        rooms[roomId].players[socket.id] = { username, score: 0, distance: null, guessed: false };
        
        // 部屋のみんなに現在のプレイヤーリストを通知
        io.to(roomId).emit('roomData', { players: rooms[roomId].players, gameStarted: rooms[roomId].gameStarted });
    });

    // ホストがゲームを開始して、全員に同じ「正解の座標」を送りつける
    socket.on('hostStartGame', ({ roomId, location, settings }) => {
        if (rooms[roomId]) {
            rooms[roomId].answerLocation = location;
            rooms[roomId].gameStarted = true;
            rooms[roomId].settings = settings;
            
            // 全プレイヤーの予想状態をリセット
            for (let id in rooms[roomId].players) {
                rooms[roomId].players[id].guessed = false;
                rooms[roomId].players[id].distance = null;
            }

            // 部屋の全員にゲーム開始の合図と座標、ルールを送る
            io.to(roomId).emit('gameStarted', { location, settings });
        }
    });

    // 誰かが「ここに決めた！」を押して予想を送ってきたとき
    socket.on('submitGuess', ({ roomId, distance, score }) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            rooms[roomId].players[socket.id].guessed = true;
            rooms[roomId].players[socket.id].distance = distance;
            rooms[roomId].players[socket.id].score = score;

            // 全員が予想し終わったかチェック
            const allPlayers = Object.values(rooms[roomId].players);
            const allGuessed = allPlayers.every(p => p.guessed);

            if (allGuessed) {
                // 全員終わったら結果発表モードへ
                io.to(roomId).emit('gameFinished', { players: rooms[roomId].players, answerLocation: rooms[roomId].answerLocation });
                rooms[roomId].gameStarted = false; // ルームの状態を戻す
            } else {
                // まだの人がいれば、現在の状況（誰が投票済か）だけ更新
                io.to(roomId).emit('roomData', { players: rooms[roomId].players, gameStarted: true });
            }
        }
    });

    // 切断されたとき
    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                io.to(roomId).emit('roomData', { players: rooms[roomId].players, gameStarted: rooms[roomId].gameStarted });
            }
        }
        console.log('ユーザーが切断しました:', socket.id);
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`サーバーが起動したよ！ http://localhost:${PORT}`);
});