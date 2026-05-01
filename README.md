# webrtc_video_streamer

WebRTCでスマホ2台向けに単方向動画配信を行う最小実装です。

## 起動
```bash
docker build -t webrtc-video-streamer .
docker run --rm -p 5173:5173 webrtc-video-streamer
```

## 使い方
1. 2台を同一Wi-Fiへ接続。
2. 両端末で `http://<PCのIP>:5173` を開く。
3. 同じルームIDを入力。
4. 片方を `sender`、もう片方を `receiver` にして参加。
