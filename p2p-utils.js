// PeerJS を使用したP2P通信管理クラス
class P2PManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.peerId = null;
        this.onMessage = null;
        this.onConnectionChange = null;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        
        // PeerJS設定 - 無料のPeerJSサーバーを使用
        this.peerConfig = {
            host: 'peerjs-server.herokuapp.com',
            port: 443,
            path: '/peerjs',
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        };
    }
    
    // ホストとしてピアを作成
    async createHost() {
        try {
            console.log('Creating host peer...');
            
            // カスタムピアIDを生成（より識別しやすい形式）
            const customPeerId = this.generatePeerId();
            
            this.peer = new Peer(customPeerId, this.peerConfig);
            this.isHost = true;
            
            return new Promise((resolve, reject) => {
                this.peer.on('open', (id) => {
                    console.log('Peer opened with ID:', id);
                    this.peerId = id;
                    this.setupHostListeners();
                    resolve(id);
                });
                
                this.peer.on('error', (error) => {
                    console.error('Peer creation error:', error);
                    reject(error);
                });
                
                // タイムアウト処理
                setTimeout(() => {
                    if (!this.peerId) {
                        reject(new Error('Peer creation timeout'));
                    }
                }, 10000);
            });
            
        } catch (error) {
            console.error('Failed to create host:', error);
            throw error;
        }
    }
    
    // クライアントとして他のピアに接続
    async connectToPeer(targetPeerId) {
        try {
            console.log('Connecting to peer:', targetPeerId);
            
            if (!targetPeerId || targetPeerId.length < 6) {
                throw new Error('無効なピアIDです');
            }
            
            // 自分用のピアを作成
            this.peer = new Peer(this.peerConfig);
            this.isHost = false;
            
            return new Promise((resolve, reject) => {
                this.peer.on('open', (id) => {
                    console.log('Client peer opened with ID:', id);
                    this.peerId = id;
                    
                    // ターゲットピアに接続
                    this.connection = this.peer.connect(targetPeerId, {
                        reliable: true,
                        metadata: {
                            type: 'commU_connection',
                            timestamp: Date.now()
                        }
                    });
                    
                    this.setupConnectionListeners(this.connection);
                    
                    // 接続完了を待つ
                    this.connection.on('open', () => {
                        console.log('Connection established to:', targetPeerId);
                        if (this.onConnectionChange) {
                            this.onConnectionChange('connected');
                        }
                        resolve(true);
                    });
                });
                
                this.peer.on('error', (error) => {
                    console.error('Connection error:', error);
                    if (this.onConnectionChange) {
                        this.onConnectionChange('failed');
                    }
                    reject(error);
                });
                
                // タイムアウト処理
                setTimeout(() => {
                    if (!this.connection || !this.connection.open) {
                        reject(new Error('接続がタイムアウトしました'));
                    }
                }, 15000);
            });
            
        } catch (error) {
            console.error('Failed to connect to peer:', error);
            throw error;
        }
    }
    
    // ホスト側のイベントリスナー設定
    setupHostListeners() {
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.connection = conn;
            this.setupConnectionListeners(conn);
            
            conn.on('open', () => {
                console.log('Connection opened from client');
                if (this.onConnectionChange) {
                    this.onConnectionChange('connected');
                }
            });
        });
        
        this.peer.on('disconnected', () => {
            console.log('Disconnected from signaling server');
            if (this.onConnectionChange) {
                this.onConnectionChange('disconnected');
            }
            
            // 再接続を試行
            this.attemptReconnect();
        });
        
        this.peer.on('close', () => {
            console.log('Peer connection closed');
            if (this.onConnectionChange) {
                this.onConnectionChange('closed');
            }
        });
        
        this.peer.on('error', (error) => {
            console.error('Peer error:', error);
            this.handlePeerError(error);
        });
    }
    
    // 接続のイベントリスナー設定
    setupConnectionListeners(connection) {
        connection.on('data', (data) => {
            console.log('Received data:', data);
            if (this.onMessage && typeof data === 'object') {
                this.onMessage(data);
            }
        });
        
        connection.on('close', () => {
            console.log('Data connection closed');
            if (this.onConnectionChange) {
                this.onConnectionChange('disconnected');
            }
        });
        
        connection.on('error', (error) => {
            console.error('Connection error:', error);
            if (this.onConnectionChange) {
                this.onConnectionChange('error');
            }
        });
    }
    
    // メッセージ送信
    sendMessage(message) {
        if (this.connection && this.connection.open) {
            try {
                console.log('Sending message:', message);
                this.connection.send(message);
                return true;
            } catch (error) {
                console.error('Failed to send message:', error);
                return false;
            }
        } else {
            console.warn('Connection not available for sending message');
            return false;
        }
    }
    
    // 接続を切断
    disconnect() {
        console.log('Disconnecting P2P connection...');
        
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.peerId = null;
        this.isHost = false;
        
        if (this.onConnectionChange) {
            this.onConnectionChange('disconnected');
        }
    }
    
    // 再接続を試行
    attemptReconnect() {
        if (this.connectionAttempts < this.maxConnectionAttempts) {
            this.connectionAttempts++;
            console.log(`Attempting reconnection ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
            
            setTimeout(() => {
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            }, 2000 * this.connectionAttempts);
        } else {
            console.log('Max reconnection attempts reached');
            if (this.onConnectionChange) {
                this.onConnectionChange('failed');
            }
        }
    }
    
    // ピアエラーを処理
    handlePeerError(error) {
        console.error('Handling peer error:', error);
        
        let errorMessage = 'P2P接続エラーが発生しました';
        
        switch (error.type) {
            case 'browser-incompatible':
                errorMessage = 'お使いのブラウザはWebRTCをサポートしていません';
                break;
            case 'disconnected':
                errorMessage = 'シグナリングサーバーから切断されました';
                break;
            case 'invalid-id':
                errorMessage = '無効なピアIDです';
                break;
            case 'invalid-key':
                errorMessage = 'PeerJSキーが無効です';
                break;
            case 'network':
                errorMessage = 'ネットワークエラーが発生しました';
                break;
            case 'peer-unavailable':
                errorMessage = '指定されたピアが見つかりません';
                break;
            case 'ssl-unavailable':
                errorMessage = 'SSL接続が利用できません';
                break;
            case 'server-error':
                errorMessage = 'サーバーエラーが発生しました';
                break;
            case 'socket-error':
                errorMessage = 'ソケット接続エラーが発生しました';
                break;
            case 'socket-closed':
                errorMessage = 'ソケット接続が閉じられました';
                break;
            case 'unavailable-id':
                errorMessage = 'このピアIDは既に使用されています';
                break;
            default:
                errorMessage = `接続エラー: ${error.message || error.type}`;
        }
        
        if (this.onConnectionChange) {
            this.onConnectionChange('error', errorMessage);
        }
    }
    
    // 接続状態を取得
    getConnectionState() {
        if (!this.peer) return 'disconnected';
        if (this.peer.destroyed) return 'destroyed';
        if (!this.peer.open) return 'connecting';
        if (this.connection && this.connection.open) return 'connected';
        return 'waiting';
    }
    
    // 現在のピアIDを取得
    getPeerId() {
        return this.peerId;
    }
    
    // ピアIDを生成（識別しやすい形式）
    generatePeerId() {
        const adjectives = ['swift', 'brave', 'bright', 'calm', 'bold', 'cool', 'fast', 'kind', 'wise', 'strong'];
        const nouns = ['tiger', 'eagle', 'wolf', 'bear', 'lion', 'fox', 'hawk', 'deer', 'owl', 'cat'];
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}-${noun}-${randomNum}`;
    }
    
    // デバッグ情報を取得
    getDebugInfo() {
        return {
            peerId: this.peerId,
            isHost: this.isHost,
            connectionState: this.getConnectionState(),
            connectionAttempts: this.connectionAttempts,
            peerOpen: this.peer ? this.peer.open : false,
            connectionOpen: this.connection ? this.connection.open : false
        };
    }
}

// ピア検索とマッチング機能
class PeerDiscovery {
    constructor(p2pManager) {
        this.p2pManager = p2pManager;
        this.discoveryInterval = null;
        this.knownPeers = new Set();
        this.onPeerDiscovered = null;
    }
    
    // ピア検索を開始
    startDiscovery() {
        console.log('Starting peer discovery...');
        
        // 定期的にピアを検索
        this.discoveryInterval = setInterval(() => {
            this.searchForPeers();
        }, 5000);
        
        // 初回検索
        this.searchForPeers();
    }
    
    // ピア検索を停止
    stopDiscovery() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
    }
    
    // ピアを検索（簡易実装）
    searchForPeers() {
        // PeerJSの制限により、直接的なピア一覧取得は困難
        // 代替として、よく使われるピアIDパターンを試行
        const commonPatterns = [
            'commU-host-001', 'commU-host-002', 'commU-host-003',
            'swift-tiger-001', 'brave-eagle-002', 'bright-wolf-003'
        ];
        
        commonPatterns.forEach(peerId => {
            if (!this.knownPeers.has(peerId) && peerId !== this.p2pManager.getPeerId()) {
                this.testPeerConnection(peerId);
            }
        });
    }
    
    // ピア接続をテスト
    async testPeerConnection(peerId) {
        try {
            // 軽量なテスト接続を試行
            const testPeer = new Peer(this.p2pManager.peerConfig);
            
            testPeer.on('open', () => {
                const testConnection = testPeer.connect(peerId, {
                    reliable: false,
                    metadata: { type: 'discovery_ping' }
                });
                
                testConnection.on('open', () => {
                    console.log('Discovered peer:', peerId);
                    this.knownPeers.add(peerId);
                    
                    if (this.onPeerDiscovered) {
                        this.onPeerDiscovered(peerId);
                    }
                    
                    // テスト接続を閉じる
                    testConnection.close();
                    testPeer.destroy();
                });
                
                testConnection.on('error', () => {
                    testPeer.destroy();
                });
                
                // タイムアウト
                setTimeout(() => {
                    if (!testConnection.open) {
                        testConnection.close();
                        testPeer.destroy();
                    }
                }, 3000);
            });
            
            testPeer.on('error', () => {
                testPeer.destroy();
            });
            
        } catch (error) {
            console.log('Peer test failed for:', peerId);
        }
    }
    
    // 発見されたピアのリストを取得
    getDiscoveredPeers() {
        return Array.from(this.knownPeers);
    }
    
    // ピアリストをクリア
    clearPeerList() {
        this.knownPeers.clear();
    }
}