// QRコード生成ライブラリ（軽量版）
class QRCodeGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = canvas.width;
    }

    generate(text) {
        // シンプルなQRコード風の生成（実際のQRコードアルゴリズムの簡易版）
        const data = this.encodeText(text);
        const moduleCount = 25;
        const moduleSize = this.size / moduleCount;
        
        // 背景を白で塗りつぶし
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.size, this.size);
        
        // データモジュールを黒で描画
        this.ctx.fillStyle = '#000000';
        
        // 位置検出パターン（3つの角）
        this.drawFinderPattern(0, 0, moduleSize);
        this.drawFinderPattern(18 * moduleSize, 0, moduleSize);
        this.drawFinderPattern(0, 18 * moduleSize, moduleSize);
        
        // データパターン（簡易版）
        for (let i = 0; i < data.length; i++) {
            if (data[i] === '1') {
                const x = (i % 17 + 4) * moduleSize;
                const y = (Math.floor(i / 17) + 4) * moduleSize;
                this.ctx.fillRect(x, y, moduleSize, moduleSize);
            }
        }
    }
    
    drawFinderPattern(x, y, moduleSize) {
        // 外枠（7x7）
        this.ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
        this.ctx.fillStyle = '#000000';
        // 内側（3x3）
        this.ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
    }
    
    encodeText(text) {
        // テキストを簡易的にバイナリパターンに変換
        let binary = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            binary += charCode.toString(2).padStart(8, '0');
        }
        
        // パターンを生成（実際のQRコードではもっと複雑）
        const pattern = [];
        for (let i = 0; i < 289; i++) { // 17x17のデータエリア
            const index = i % binary.length;
            pattern.push(binary[index]);
        }
        
        return pattern.join('');
    }
}

// QRコードスキャナー（簡易版）
class QRCodeScanner {
    constructor(video) {
        this.video = video;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scanning = false;
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', // 背面カメラを優先
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            this.video.srcObject = stream;
            this.stream = stream;
            return true;
        } catch (error) {
            console.error('Camera access failed:', error);
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.scanning = false;
    }

    async switchCamera() {
        this.stopCamera();
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length > 1) {
                // 現在と異なるカメラを選択
                const currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
                this.currentFacingMode = currentFacingMode;
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: currentFacingMode }
                });
                this.video.srcObject = stream;
                this.stream = stream;
            }
        } catch (error) {
            console.error('Camera switch failed:', error);
            // フォールバック：元のカメラに戻す
            this.startCamera();
        }
    }

    startScanning(onResult) {
        this.scanning = true;
        this.onResult = onResult;
        this.currentFacingMode = 'environment';
        this.scanFrame();
    }

    scanFrame() {
        if (!this.scanning) return;

        // 簡易的なQRコード検出（実際のアプリでは専用ライブラリを使用）
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        
        // QRコードパターンの検出を試行
        const result = this.detectQRPattern();
        if (result) {
            this.onResult(result);
            return;
        }

        // 次のフレームをスキャン
        requestAnimationFrame(() => this.scanFrame());
    }

    detectQRPattern() {
        // 実際の実装では、QRコードライブラリを使用
        // ここでは、手動入力または接続IDの形式をチェック
        
        // デモ用：特定のパターンを返す
        if (Math.random() < 0.01) { // 1%の確率でデモQRコードを検出
            return 'demo-connection-id-12345';
        }
        
        return null;
    }
}

// WebRTC接続管理
class WebRTCManager {
    constructor() {
        this.peer = null;
        this.dataChannel = null;
        this.connectionId = this.generateConnectionId();
        this.isHost = false;
        this.onMessage = null;
        this.onConnectionChange = null;
        
        // STUN/TURNサーバー設定（無料のGoogle STUNサーバー）
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }
    
    generateConnectionId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    async createHost() {
        this.isHost = true;
        this.peer = new RTCPeerConnection(this.configuration);
        
        // データチャンネルを作成
        this.dataChannel = this.peer.createDataChannel('commU', {
            ordered: true
        });
        
        this.setupDataChannel(this.dataChannel);
        this.setupPeerEvents();
        
        // オファーを作成
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        
        // 接続情報をシンプルに保存（実際の実装ではシグナリングサーバーを使用）
        this.storeOfferForClient(this.connectionId, offer);
        
        return this.connectionId;
    }
    
    async connectToHost(connectionId) {
        this.isHost = false;
        this.peer = new RTCPeerConnection(this.configuration);
        
        this.setupPeerEvents();
        
        // データチャンネルの受信準備
        this.peer.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel(this.dataChannel);
        };
        
        // オファーを取得（実際の実装ではシグナリングサーバーから）
        const offer = this.getOfferFromStore(connectionId);
        if (!offer) {
            throw new Error('接続IDが見つかりません');
        }
        
        await this.peer.setRemoteDescription(offer);
        
        // アンサーを作成
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        
        // アンサーを保存（実際の実装ではシグナリングサーバーに送信）
        this.storeAnswerForHost(connectionId, answer);
        
        return true;
    }
    
    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('Data channel opened');
            if (this.onConnectionChange) {
                this.onConnectionChange('connected');
            }
        };
        
        channel.onmessage = (event) => {
            if (this.onMessage) {
                this.onMessage(JSON.parse(event.data));
            }
        };
        
        channel.onclose = () => {
            console.log('Data channel closed');
            if (this.onConnectionChange) {
                this.onConnectionChange('disconnected');
            }
        };
    }
    
    setupPeerEvents() {
        this.peer.onicecandidate = (event) => {
            if (event.candidate) {
                // ICE候補を相手に送信（実際の実装ではシグナリングサーバー経由）
                this.storeIceCandidate(this.connectionId, event.candidate);
            }
        };
        
        this.peer.onconnectionstatechange = () => {
            console.log('Connection state:', this.peer.connectionState);
            if (this.onConnectionChange) {
                this.onConnectionChange(this.peer.connectionState);
            }
        };
    }
    
    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    }
    
    disconnect() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peer) {
            this.peer.close();
        }
        this.clearStoredData(this.connectionId);
    }
    
    // 簡易的なシグナリング（実際の実装ではサーバーを使用）
    storeOfferForClient(connectionId, offer) {
        localStorage.setItem(`offer_${connectionId}`, JSON.stringify(offer));
        // 実際の実装では、有効期限を設定
        setTimeout(() => {
            localStorage.removeItem(`offer_${connectionId}`);
        }, 300000); // 5分後に削除
    }
    
    getOfferFromStore(connectionId) {
        const stored = localStorage.getItem(`offer_${connectionId}`);
        return stored ? JSON.parse(stored) : null;
    }
    
    storeAnswerForHost(connectionId, answer) {
        localStorage.setItem(`answer_${connectionId}`, JSON.stringify(answer));
    }
    
    storeIceCandidate(connectionId, candidate) {
        const key = `ice_${connectionId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(candidate);
        localStorage.setItem(key, JSON.stringify(existing));
    }
    
    clearStoredData(connectionId) {
        localStorage.removeItem(`offer_${connectionId}`);
        localStorage.removeItem(`answer_${connectionId}`);
        localStorage.removeItem(`ice_${connectionId}`);
    }
}