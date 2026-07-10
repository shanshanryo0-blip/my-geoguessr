const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Render上でpublicフォルダを正しく読み込ませる設定
app.use(express.static(path.join(__dirname, 'public')));

// URLにアクセスしたときに、publicの中のindex.htmlを確実に返す設定
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.ioの通信処理（部屋の入退室など）
io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');

    socket.on('join-room', (roomId, username) => {
        socket.join(roomId);
        socket.username = username;
        socket.roomId = roomId;
        
        // 部屋のメンバー一覧を取得して全員に通知
        const clients = io.sockets.adapter.rooms.get(roomId);
        const users = [];
        if (clients) {
            for (const clientId of clients) {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket && clientSocket.username) {
                    users.push(clientSocket.username);
                }
            }
        }
        io.to(roomId).emit('room-users', users);
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            const roomId = socket.roomId;
            const clients = io.sockets.adapter.rooms.get(roomId);
            const users = [];
            if (clients) {
                for (const clientId of clients) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    if (clientSocket && clientSocket.username) {
                        users.push(clientSocket.username);
                    }
                }
            }
            io.to(roomId).emit('room-users', users);
        }
    });
});

// Renderのポート（環境変数）に対応させる設定
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`サーバーが起動したよ！ ポート: ${PORT}`);
});
