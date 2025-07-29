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
        // ここでは、画像解析によるQRコード検出を簡易実装
        
        try {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            // QRコードパターンの検出（簡易版）
            const detectedPattern = this.analyzeQRPattern(data, this.canvas.width, this.canvas.height);
            if (detectedPattern) {
                return detectedPattern;
            }
            
            // 手動入力や既存の接続IDをチェック
            const storedConnections = this.checkStoredConnections();
            if (storedConnections.length > 0) {
                // 最新の接続IDを返す
                return storedConnections[0];
            }
            
        } catch (error) {
            console.error('QR pattern detection error:', error);
        }
        
        return null;
    }
    
    analyzeQRPattern(imageData, width, height) {
        // QRコードの特徴的なパターンを検出
        // 位置検出パターン（Finder Pattern）を探す
        
        const threshold = 128;
        const minPatternSize = 20;
        const maxPatternSize = 100;
        
        // グレースケール変換と2値化
        const binaryData = [];
        for (let i = 0; i < imageData.length; i += 4) {
            const gray = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
            binaryData.push(gray < threshold ? 0 : 255);
        }
        
        // 位置検出パターンを探す（7x7の黒白黒白黒パターン）
        for (let y = 0; y < height - maxPatternSize; y += 2) {
            for (let x = 0; x < width - maxPatternSize; x += 2) {
                const pattern = this.checkFinderPattern(binaryData, x, y, width, height);
                if (pattern) {
                    // パターンが見つかった場合、周辺のデータを解析
                    const decodedData = this.decodeQRData(binaryData, x, y, width, height);
                    if (decodedData && this.isValidConnectionId(decodedData)) {
                        return decodedData;
                    }
                }
            }
        }
        
        return null;
    }
    
    checkFinderPattern(binaryData, startX, startY, width, height) {
        // 7x7の位置検出パターンをチェック
        const patternSize = 7;
        if (startX + patternSize >= width || startY + patternSize >= height) {
            return false;
        }
        
        // パターンの中心を確認（3x3の黒い領域）
        const centerX = startX + 3;
        const centerY = startY + 3;
        const centerIndex = centerY * width + centerX;
        
        return binaryData[centerIndex] === 0; // 黒ピクセル
    }
    
    decodeQRData(binaryData, x, y, width, height) {
        // QRコードのデータ部分を解析（簡易版）
        // 実際の実装では、Reed-Solomon誤り訂正なども必要
        
        const dataRegionX = x + 10;
        const dataRegionY = y + 10;
        const dataSize = 10;
        
        let binaryString = '';
        for (let dy = 0; dy < dataSize; dy++) {
            for (let dx = 0; dx < dataSize; dx++) {
                const pixelX = dataRegionX + dx;
                const pixelY = dataRegionY + dy;
                
                if (pixelX < width && pixelY < height) {
                    const index = pixelY * width + pixelX;
                    binaryString += binaryData[index] === 0 ? '1' : '0';
                }
            }
        }
        
        // バイナリデータを文字列に変換
        try {
            let result = '';
            for (let i = 0; i < binaryString.length; i += 8) {
                const byte = binaryString.substr(i, 8);
                if (byte.length === 8) {
                    const charCode = parseInt(byte, 2);
                    if (charCode >= 32 && charCode <= 126) { // 印刷可能文字
                        result += String.fromCharCode(charCode);
                    }
                }
            }
            return result.length >= 6 ? result.substring(0, 6) : null;
        } catch (error) {
            return null;
        }
    }
    
    checkStoredConnections() {
        // localStorageから既存の接続情報を取得
        const connections = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('offer_')) {
                const connectionId = key.replace('offer_', '');
                connections.push(connectionId);
            }
        }
        return connections.sort().reverse(); // 新しい順
    }
    
    isValidConnectionId(id) {
        // 接続IDの形式をチェック（6文字の英数字）
        return /^[A-Z0-9]{6}$/.test(id);
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
            // 利用可能な接続IDを取得
            const availableIds = this.getAvailableConnectionIds();
            let errorMessage = `接続ID「${connectionId}」が見つかりません。`;
            
            if (availableIds.length > 0) {
                errorMessage += `\n\n利用可能な接続ID:\n${availableIds.join(', ')}`;
            } else {
                errorMessage += '\n\n現在、利用可能な接続IDがありません。\nホスト側で接続を開始してからQRコードを読み取ってください。';
            }
            
            throw new Error(errorMessage);
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
        console.log('Looking for connection ID:', connectionId);
        
        // 全てのlocalStorageキーを確認
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('offer_')) {
                allKeys.push(key);
            }
        }
        console.log('Available offer keys:', allKeys);
        
        const key = `offer_${connectionId}`;
        const stored = localStorage.getItem(key);
        
        if (!stored) {
            console.warn(`Connection ID ${connectionId} not found in localStorage`);
            return null;
        }
        
        try {
            const parsed = JSON.parse(stored);
            console.log('Found offer for connection ID:', connectionId);
            return parsed;
        } catch (error) {
            console.error('Failed to parse stored offer:', error);
            return null;
        }
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
    
    getAvailableConnectionIds() {
        const connectionIds = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('offer_')) {
                const connectionId = key.replace('offer_', '');
                connectionIds.push(connectionId);
            }
        }
        return connectionIds.sort();
    }
    
    clearStoredData(connectionId) {
        localStorage.removeItem(`offer_${connectionId}`);
        localStorage.removeItem(`answer_${connectionId}`);
        localStorage.removeItem(`ice_${connectionId}`);
    }
}