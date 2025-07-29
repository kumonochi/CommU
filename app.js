class CommUApp {
    constructor() {
        this.bluetoothDevice = null;
        this.bluetoothServer = null;
        this.bluetoothService = null;
        this.bluetoothCharacteristic = null;
        this.isHost = false;
        this.currentRole = null;
        this.currentRoom = null;
        this.chatHistory = [];
        this.answerButtonTexts = {
            yes: ['はい', 'うん', 'もちろん！'],
            no: ['いいえ', 'ううん', 'やだ！']
        };
        this.currentAnswerIndex = {
            yes: 0,
            no: 0
        };
        this.roomParticipants = {}; // ルーム参加者管理
        this.connectedDevices = []; // 接続デバイス管理
        this.isAnswererConnected = false; // 回答者接続状態
        this.messageBuffer = new Map(); // 分割メッセージのバッファ
        this.reconnectAttempts = 0; // 再接続試行回数
        this.maxReconnectAttempts = 3; // 最大再接続試行回数
        this.debugMode = false; // デバッグモード
        this.connectionMethod = null; // 'bluetooth' または 'webrtc'
        this.webrtcManager = null; // WebRTC接続管理
        this.qrGenerator = null; // QRコード生成
        this.qrScanner = null; // QRコードスキャナー
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showScreen('bluetooth-screen');
    }

    setupEventListeners() {
        // Bluetooth接続
        document.getElementById('host-btn').addEventListener('click', () => this.startHost());
        document.getElementById('connect-btn').addEventListener('click', () => this.connectToDevice());

        // 役割選択
        document.getElementById('questioner-role').addEventListener('click', () => this.selectRole('questioner'));
        document.getElementById('answerer-role').addEventListener('click', () => this.selectRole('answerer'));
        document.getElementById('sound-role').addEventListener('click', () => this.selectRole('sound'));

        // ルーム作成
        this.setupNumpad();
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('back-to-role-btn').addEventListener('click', () => this.showScreen('role-screen'));
        document.getElementById('back-to-role-btn2').addEventListener('click', () => this.showScreen('role-screen'));

        // 質問者画面
        document.getElementById('send-question-btn').addEventListener('click', () => this.sendQuestion());
        document.getElementById('exit-room-btn').addEventListener('click', () => this.exitRoom('questioner'));

        // 回答者画面
        document.getElementById('send-message-btn').addEventListener('click', () => this.sendFreeMessage());
        document.getElementById('answer-yes').addEventListener('click', () => this.sendAnswer('yes'));
        document.getElementById('answer-no').addEventListener('click', () => this.sendAnswer('no'));
        document.getElementById('answer-maybe').addEventListener('click', () => this.sendAnswer('maybe'));
        document.getElementById('answer-refuse').addEventListener('click', () => this.sendAnswer('refuse'));
        document.getElementById('send-text-answer-btn').addEventListener('click', () => this.sendTextAnswer());
        document.getElementById('exit-room-btn-answerer').addEventListener('click', () => this.exitRoom('answerer'));

        // カスタマイズボタン
        document.getElementById('customize-yes').addEventListener('click', () => this.showCustomizeModal('yes'));
        document.getElementById('customize-no').addEventListener('click', () => this.showCustomizeModal('no'));
        document.getElementById('close-customize').addEventListener('click', () => this.hideCustomizeModal());

        // 音響モード
        document.getElementById('back-from-sound').addEventListener('click', () => this.showScreen('role-screen'));
        document.querySelectorAll('.sound-answer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.playSoundAnswer(e.target.dataset.answer));
        });

        // エクスポートモーダル
        document.getElementById('export-txt').addEventListener('click', () => this.exportData('txt'));
        document.getElementById('export-csv').addEventListener('click', () => this.exportData('csv'));
        document.getElementById('export-email').addEventListener('click', () => this.exportData('email'));
        document.getElementById('skip-export').addEventListener('click', () => this.skipExport());

        // 接続方法選択
        document.getElementById('qr-connection').addEventListener('click', () => this.selectConnectionMethod('webrtc'));
        document.getElementById('bluetooth-connection').addEventListener('click', () => this.selectConnectionMethod('bluetooth'));
        document.getElementById('back-to-connection').addEventListener('click', () => this.showScreen('connection-screen'));

        // QRコード接続
        document.getElementById('qr-host-btn').addEventListener('click', () => this.startQRHost());
        document.getElementById('qr-scan-btn').addEventListener('click', () => this.startQRScan());
        document.getElementById('back-from-qr').addEventListener('click', () => this.showScreen('connection-screen'));
        document.getElementById('toggle-camera').addEventListener('click', () => this.toggleCamera());
        document.getElementById('manual-input-btn').addEventListener('click', () => this.toggleManualInput());
        document.getElementById('manual-connect-btn').addEventListener('click', () => this.connectManually());

        // デバッグ機能（隠しコマンド：タイトルを5回タップ）
        let tapCount = 0;
        const titleElement = document.querySelector('.app-title');
        if (titleElement) {
            titleElement.addEventListener('click', () => {
                tapCount++;
                if (tapCount >= 5) {
                    this.toggleDebugMode();
                    tapCount = 0;
                }
                setTimeout(() => { tapCount = 0; }, 2000);
            });
        }
    }

    setupNumpad() {
        const numBtns = document.querySelectorAll('.num-btn[data-num]');
        const clearBtn = document.querySelector('.clear-btn');
        const randomBtn = document.querySelector('.random-btn');
        const roomIdInput = document.getElementById('room-id-input');
        const createBtn = document.getElementById('create-room-btn');

        let roomId = '';

        numBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (roomId.length < 5) {
                    roomId += btn.dataset.num;
                    this.updateRoomIdDisplay(roomId);
                    if (roomId.length === 5) {
                        createBtn.disabled = false;
                    }
                }
            });
        });

        clearBtn.addEventListener('click', () => {
            roomId = '';
            this.updateRoomIdDisplay('');
            createBtn.disabled = true;
        });

        randomBtn.addEventListener('click', () => {
            roomId = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
            this.updateRoomIdDisplay(roomId);
            createBtn.disabled = false;
        });
    }

    updateRoomIdDisplay(roomId) {
        const display = document.getElementById('room-id-input');
        const padded = roomId.padEnd(5, '-');
        display.textContent = padded;
    }

    async startHost() {
        try {
            this.isHost = true;
            this.showDebugLog('info', 'ホストとして接続を開始');
            // Bluetooth接続の実装（Web Bluetooth APIを使用）
            await this.requestBluetoothDevice();
            this.showScreen('role-screen');
        } catch (error) {
            this.showDebugLog('error', 'Bluetooth host start failed', error);
            this.showMessage(`Bluetooth接続に失敗しました: ${error.message}`);
        }
    }

    async connectToDevice() {
        try {
            this.isHost = false;
            await this.requestBluetoothDevice();
            this.showScreen('role-screen');
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            this.showMessage('Bluetooth接続に失敗しました');
        }
    }

    async requestBluetoothDevice() {
        if (!navigator.bluetooth) {
            throw new Error('Bluetooth APIがサポートされていません。HTTPS環境で実行してください。');
        }

        // CommUアプリ専用のBluetooth Low Energy サービスUUID
        const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Nordic UART Service
        const TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // TX Characteristic
        const RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // RX Characteristic

        try {
            // デバイスの検索と選択
            this.showMessage('Bluetoothデバイスを検索中...');
            
            this.bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [SERVICE_UUID] },
                    { namePrefix: 'CommU' },
                    { namePrefix: 'ESP32' },
                    { namePrefix: 'Arduino' }
                ],
                optionalServices: [SERVICE_UUID]
            });

            // 切断イベントの監視
            this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
                this.onBluetoothDisconnected();
            });

            this.showMessage('デバイスに接続中...');
            this.bluetoothServer = await this.bluetoothDevice.gatt.connect();
            
            this.showMessage('サービスを取得中...');
            this.bluetoothService = await this.bluetoothServer.getPrimaryService(SERVICE_UUID);
            
            // 送信用特性（ホスト側）
            if (this.isHost) {
                this.bluetoothTxCharacteristic = await this.bluetoothService.getCharacteristic(TX_CHARACTERISTIC_UUID);
                this.bluetoothRxCharacteristic = await this.bluetoothService.getCharacteristic(RX_CHARACTERISTIC_UUID);
                
                // 受信通知を有効化
                await this.bluetoothRxCharacteristic.startNotifications();
                this.bluetoothRxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                    this.handleBluetoothMessage(event);
                });
            } else {
                // クライアント側
                this.bluetoothTxCharacteristic = await this.bluetoothService.getCharacteristic(RX_CHARACTERISTIC_UUID);
                this.bluetoothRxCharacteristic = await this.bluetoothService.getCharacteristic(TX_CHARACTERISTIC_UUID);
                
                // 受信通知を有効化
                await this.bluetoothRxCharacteristic.startNotifications();
                this.bluetoothRxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                    this.handleBluetoothMessage(event);
                });
            }

            this.showMessage('Bluetooth接続が完了しました');
            
            // 接続確認メッセージを送信
            setTimeout(() => {
                this.sendBluetoothMessage({
                    type: 'connection_established',
                    data: { 
                        deviceId: this.generateDeviceId(),
                        isHost: this.isHost,
                        timestamp: new Date().toISOString()
                    }
                });
            }, 1000);

        } catch (error) {
            console.error('Bluetooth connection error:', error);
            
            if (error.name === 'NotFoundError') {
                throw new Error('対応するBluetoothデバイスが見つかりませんでした。デバイスの電源を確認してください。');
            } else if (error.name === 'SecurityError') {
                throw new Error('Bluetooth接続がブロックされました。HTTPS環境で実行してください。');
            } else if (error.name === 'NetworkError') {
                throw new Error('Bluetoothデバイスとの通信に失敗しました。距離を近づけて再試行してください。');
            } else {
                throw new Error(`Bluetooth接続エラー: ${error.message}`);
            }
        }
    }

    handleBluetoothMessage(event) {
        try {
            const data = new Uint8Array(event.target.value.buffer);
            
            // 分割メッセージかどうかをチェック
            if (data.length > 2 && data[1] > 1) {
                // 分割メッセージの処理
                this.handleChunkedMessage(data);
                return;
            }
            
            // 通常のメッセージ処理
            const value = new TextDecoder().decode(data);
            const message = JSON.parse(value);
            
            this.processMessage(message);
            
        } catch (error) {
            console.error('Failed to process Bluetooth message:', error);
        }
    }

    handleChunkedMessage(data) {
        const chunkNumber = data[0];
        const totalChunks = data[1];
        const messageData = data.slice(2);
        const messageId = `msg_${Date.now()}`; // 簡易的なメッセージID
        
        if (!this.messageBuffer.has(messageId)) {
            this.messageBuffer.set(messageId, {
                chunks: new Array(totalChunks),
                receivedChunks: 0
            });
        }
        
        const buffer = this.messageBuffer.get(messageId);
        buffer.chunks[chunkNumber] = messageData;
        buffer.receivedChunks++;
        
        // すべてのチャンクが揃った場合
        if (buffer.receivedChunks === totalChunks) {
            const completeData = new Uint8Array(
                buffer.chunks.reduce((total, chunk) => total + chunk.length, 0)
            );
            
            let offset = 0;
            buffer.chunks.forEach(chunk => {
                completeData.set(chunk, offset);
                offset += chunk.length;
            });
            
            const value = new TextDecoder().decode(completeData);
            const message = JSON.parse(value);
            
            this.processMessage(message);
            this.messageBuffer.delete(messageId);
        }
    }

    processMessage(message) {
        switch (message.type) {
            case 'question':
                this.receiveQuestion(message.data);
                break;
            case 'answer':
                this.receiveAnswer(message.data);
                break;
            case 'message':
                this.receiveMessage(message.data);
                break;
            case 'room_created':
                this.handleRoomCreated(message.data);
                break;
            case 'room_joined':
                this.handleRoomJoined(message.data);
                break;
            case 'room_full':
                this.handleRoomFull(message.data);
                break;
            case 'participant_joined':
                this.handleParticipantJoined(message.data);
                break;
            case 'connection_established':
                this.handleConnectionEstablished(message.data);
                break;
        }
    }

    async sendBluetoothMessage(message) {
        if (this.bluetoothTxCharacteristic && this.bluetoothServer && this.bluetoothServer.connected) {
            try {
                const messageString = JSON.stringify(message);
                const data = new TextEncoder().encode(messageString);
                
                // メッセージサイズ制限（BLEの制限に対応）
                const MAX_CHUNK_SIZE = 20;
                
                if (data.length <= MAX_CHUNK_SIZE) {
                    await this.bluetoothTxCharacteristic.writeValue(data);
                } else {
                    // 大きなメッセージを分割して送信
                    await this.sendLargeMessage(data);
                }
                
                console.log('Bluetooth message sent:', message.type);
                
            } catch (error) {
                console.error('Failed to send Bluetooth message:', error);
                this.showMessage(`送信エラー: ${error.message}`);
                
                // 再接続を試行
                if (error.name === 'NetworkError') {
                    this.attemptReconnection();
                }
            }
        } else {
            console.log('Bluetooth not connected, message queued:', message);
            // デモ用のシミュレーション（実際の実装では再接続またはキューイング）
            this.showMessage('Bluetooth未接続 - デモモードで動作中');
        }
    }

    async sendLargeMessage(data) {
        const MAX_CHUNK_SIZE = 20;
        const totalChunks = Math.ceil(data.length / MAX_CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * MAX_CHUNK_SIZE;
            const end = Math.min(start + MAX_CHUNK_SIZE, data.length);
            const chunk = data.slice(start, end);
            
            // チャンクヘッダーを追加（チャンク番号/総チャンク数）
            const chunkWithHeader = new Uint8Array(chunk.length + 2);
            chunkWithHeader[0] = i; // チャンク番号
            chunkWithHeader[1] = totalChunks; // 総チャンク数
            chunkWithHeader.set(chunk, 2);
            
            await this.bluetoothTxCharacteristic.writeValue(chunkWithHeader);
            
            // 短い待機時間（BLEの安定性のため）
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    selectRole(role) {
        this.currentRole = role;
        
        switch (role) {
            case 'questioner':
                this.showScreen('room-create-screen');
                break;
            case 'answerer':
                this.showRoomList();
                break;
            case 'sound':
                this.showScreen('sound-mode-screen');
                break;
        }
    }

    createRoom() {
        const roomId = document.getElementById('room-id-input').textContent.replace(/-/g, '');
        this.currentRoom = roomId;
        
        // ルーム参加者を初期化（質問者として登録）
        this.roomParticipants[roomId] = {
            questioner: { deviceId: 'host', connected: true },
            answerer: null,
            participantCount: 1
        };
        
        document.getElementById('current-room-id').textContent = roomId;
        this.showScreen('questioner-screen');
        
        // ルーム作成をBluetooth経由で通知
        this.sendBluetoothMessage({
            type: 'room_created',
            data: { roomId: roomId, creatorRole: 'questioner' }
        });
    }

    showRoomList() {
        // デモ用のルーム一覧を表示
        const roomList = document.getElementById('room-list');
        roomList.innerHTML = '';
        
        // 実際の実装では、利用可能なルーム一覧を取得
        const availableRooms = ['12345', '67890', '11111'];
        
        availableRooms.forEach(roomId => {
            const roomItem = document.createElement('button');
            roomItem.className = 'room-item';
            
            // ルーム満員チェック
            const roomInfo = this.roomParticipants[roomId];
            const isFull = roomInfo && roomInfo.participantCount >= 2;
            
            if (isFull) {
                roomItem.textContent = `ルーム ${roomId} (満席)`;
                roomItem.disabled = true;
                roomItem.style.backgroundColor = '#f5f5f5';
                roomItem.style.color = '#999';
                roomItem.addEventListener('click', () => this.showMessage('満席です'));
            } else {
                roomItem.textContent = `ルーム ${roomId}`;
                roomItem.addEventListener('click', () => this.joinRoom(roomId));
            }
            
            roomList.appendChild(roomItem);
        });
        
        this.showScreen('room-join-screen');
    }

    joinRoom(roomId) {
        // ルーム満員チェック
        const roomInfo = this.roomParticipants[roomId];
        if (roomInfo && roomInfo.participantCount >= 2) {
            this.showMessage('満席です');
            return;
        }
        
        this.currentRoom = roomId;
        
        // ルーム参加者情報を更新
        if (!this.roomParticipants[roomId]) {
            this.roomParticipants[roomId] = {
                questioner: null,
                answerer: { deviceId: 'answerer', connected: true },
                participantCount: 1
            };
        } else {
            this.roomParticipants[roomId].answerer = { deviceId: 'answerer', connected: true };
            this.roomParticipants[roomId].participantCount = 2;
        }
        
        document.getElementById('current-room-id-answerer').textContent = roomId;
        this.showScreen('answerer-screen');
        document.getElementById('answerer-content').classList.remove('hidden');
        
        // ルーム参加をBluetooth経由で通知
        this.sendBluetoothMessage({
            type: 'room_joined',
            data: { roomId: roomId, joinerRole: 'answerer' }
        });
        
        // 質問者に参加通知を送信
        this.sendBluetoothMessage({
            type: 'participant_joined',
            data: { roomId: roomId, role: 'answerer' }
        });
    }

    sendQuestion() {
        const questionText = document.getElementById('question-input').value.trim();
        const animation = document.getElementById('animation-select').value;
        
        if (!questionText) {
            this.showMessage('質問を入力してください');
            return;
        }

        const questionData = {
            text: questionText,
            animation: animation,
            timestamp: new Date().toISOString()
        };

        this.addToChatHistory('questioner', questionText);
        document.getElementById('question-input').value = '';

        // 統合メッセージ送信
        this.sendMessage({
            type: 'question',
            data: questionData
        });
    }

    receiveQuestion(questionData) {
        const questionElement = document.getElementById('question-text');
        questionElement.textContent = questionData.text;
        
        // アニメーション適用
        if (questionData.animation && questionData.animation !== 'none') {
            questionElement.className = `question-text animation-${questionData.animation}`;
            setTimeout(() => {
                questionElement.className = 'question-text';
            }, 2000);
        }

        document.getElementById('waiting-question').classList.add('hidden');
        document.getElementById('answerer-content').classList.remove('hidden');
    }

    sendAnswer(answerType) {
        const soundEffect = document.getElementById('sound-select').value;
        let answerText = '';
        
        switch (answerType) {
            case 'yes':
                answerText = this.answerButtonTexts.yes[this.currentAnswerIndex.yes];
                break;
            case 'no':
                answerText = this.answerButtonTexts.no[this.currentAnswerIndex.no];
                break;
            case 'maybe':
                answerText = 'わからない';
                break;
            case 'refuse':
                answerText = '答えたくない';
                break;
        }

        this.playSoundEffect(soundEffect);
        
        const answerData = {
            text: answerText,
            type: answerType,
            sound: soundEffect,
            timestamp: new Date().toISOString()
        };

        // Bluetooth経由で回答を送信
        this.sendBluetoothMessage({
            type: 'answer',
            data: answerData
        });
    }

    sendTextAnswer() {
        const textAnswer = document.getElementById('text-answer-input').value.trim();
        
        if (!textAnswer) {
            this.showMessage('テキストを入力してください');
            return;
        }

        const soundEffect = document.getElementById('sound-select').value;
        this.playSoundEffect(soundEffect);

        const answerData = {
            text: textAnswer,
            type: 'text',
            sound: soundEffect,
            timestamp: new Date().toISOString()
        };

        document.getElementById('text-answer-input').value = '';

        // Bluetooth経由で回答を送信
        this.sendBluetoothMessage({
            type: 'answer',
            data: answerData
        });
    }

    receiveAnswer(answerData) {
        this.addToChatHistory('answerer', answerData.text);
        this.playSoundEffect(answerData.sound);
    }

    sendFreeMessage() {
        const messageText = document.getElementById('free-message-input').value.trim();
        
        if (!messageText) {
            return;
        }

        const messageData = {
            text: messageText,
            timestamp: new Date().toISOString()
        };

        document.getElementById('free-message-input').value = '';

        // Bluetooth経由でメッセージを送信
        this.sendBluetoothMessage({
            type: 'message',
            data: messageData
        });
    }

    receiveMessage(messageData) {
        this.showPopupMessage(messageData.text);
        this.addToChatHistory('answerer', `[メッセージ] ${messageData.text}`);
    }

    addToChatHistory(sender, content) {
        this.chatHistory.push({ sender, content, timestamp: new Date().toISOString() });
        this.updateChatHistoryDisplay();
    }

    updateChatHistoryDisplay() {
        const historyElement = document.getElementById('chat-history');
        historyElement.innerHTML = '';

        this.chatHistory.forEach(item => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${item.sender}`;
            chatItem.innerHTML = `
                <strong>${item.sender === 'questioner' ? '質問者' : '回答者'}:</strong>
                <span>${item.content}</span>
            `;
            historyElement.appendChild(chatItem);
        });

        historyElement.scrollTop = historyElement.scrollHeight;
    }

    showCustomizeModal(buttonType) {
        const modal = document.getElementById('customize-modal');
        const title = document.getElementById('customize-title');
        const options = document.querySelectorAll('.customize-option');

        title.textContent = `「${buttonType === 'yes' ? 'はい' : 'いいえ'}」ボタンをカスタマイズ`;
        
        const texts = this.answerButtonTexts[buttonType];
        options.forEach((option, index) => {
            option.textContent = texts[index];
            option.dataset.value = index;
            option.onclick = () => this.selectCustomOption(buttonType, index);
        });

        modal.classList.add('active');
    }

    selectCustomOption(buttonType, index) {
        this.currentAnswerIndex[buttonType] = index;
        const buttonElement = document.getElementById(`answer-${buttonType}`);
        buttonElement.textContent = this.answerButtonTexts[buttonType][index];
        
        const customizeButton = document.getElementById(`customize-${buttonType}`);
        customizeButton.textContent = this.answerButtonTexts[buttonType][index];
        
        this.hideCustomizeModal();
    }

    hideCustomizeModal() {
        document.getElementById('customize-modal').classList.remove('active');
    }

    playSoundEffect(soundType) {
        if (soundType === 'none') return;

        // 実際の実装では音声ファイルを再生
        // この例では Audio API を使用
        const sounds = {
            ping: { frequency: 800, duration: 200 },
            buzz: { frequency: 200, duration: 500 },
            sparkle: { frequency: 1200, duration: 300 },
            don: { frequency: 100, duration: 800 },
            deden: { frequency: 150, duration: 400 }
        };

        if (sounds[soundType]) {
            this.playTone(sounds[soundType].frequency, sounds[soundType].duration);
        }
    }

    playSoundAnswer(answerType) {
        const isVoiceSynthesis = document.getElementById('voice-synthesis-toggle').checked;
        
        if (isVoiceSynthesis) {
            this.speakText(answerType);
        } else {
            this.playSoundEffect(answerType);
        }
    }

    speakText(answerType) {
        if ('speechSynthesis' in window) {
            const texts = {
                yes: 'はい',
                no: 'いいえ',
                maybe: 'わからない',
                refuse: '答えたくない'
            };
            
            const utterance = new SpeechSynthesisUtterance(texts[answerType]);
            utterance.lang = 'ja-JP';
            speechSynthesis.speak(utterance);
        }
    }

    playTone(frequency, duration) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    exitRoom(role) {
        if (role === 'questioner' && this.chatHistory.length > 0) {
            this.showExportModal();
        } else {
            this.resetToRoleSelection();
        }
    }

    showExportModal() {
        document.getElementById('export-modal').classList.add('active');
    }

    exportData(format) {
        if (format === 'txt') {
            this.exportAsTXT();
        } else if (format === 'csv') {
            this.exportAsCSV();
        } else if (format === 'email') {
            this.exportByEmail();
        }
        
        this.hideExportModal();
        this.resetToRoleSelection();
    }

    exportAsTXT() {
        let content = '';
        this.chatHistory.forEach(item => {
            const role = item.sender === 'questioner' ? '質問者' : '回答者';
            content += `${role}：${item.content}\n`;
        });

        this.downloadFile('chat_history.txt', content, 'text/plain');
    }

    exportAsCSV() {
        let content = '応答者,内容\n';
        this.chatHistory.forEach(item => {
            const role = item.sender === 'questioner' ? '質問者' : '回答者';
            content += `"${role}","${item.content}"\n`;
        });

        this.downloadFile('chat_history.csv', content, 'text/csv');
    }

    exportByEmail() {
        let content = '';
        this.chatHistory.forEach(item => {
            const role = item.sender === 'questioner' ? '質問者' : '回答者';
            content += `${role}：${item.content}\n`;
        });

        const subject = 'CommU⇆ やりとり履歴';
        const body = encodeURIComponent(content);
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
        
        window.open(mailtoLink);
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.click();
        
        window.URL.revokeObjectURL(url);
    }

    skipExport() {
        this.hideExportModal();
        this.resetToRoleSelection();
    }

    hideExportModal() {
        document.getElementById('export-modal').classList.remove('active');
    }

    resetToRoleSelection() {
        this.chatHistory = [];
        this.currentRoom = null;
        this.currentRole = null;
        this.showScreen('role-screen');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showMessage(message) {
        this.showPopupMessage(message);
    }

    showPopupMessage(message) {
        const popup = document.createElement('div');
        popup.className = 'popup-message';
        popup.textContent = message;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.remove();
        }, 10000);
    }

    // デバッグ用ログ表示機能
    showDebugLog(level, message, data = null) {
        // コンソールログ
        console[level](message, data);
        
        // 画面上にもデバッグ情報を表示（開発モード時）
        if (this.debugMode) {
            const debugElement = this.getOrCreateDebugElement();
            const logEntry = document.createElement('div');
            logEntry.className = `debug-entry debug-${level}`;
            logEntry.innerHTML = `
                <span class="debug-time">${new Date().toLocaleTimeString()}</span>
                <span class="debug-level">[${level.toUpperCase()}]</span>
                <span class="debug-message">${message}</span>
                ${data ? `<pre class="debug-data">${JSON.stringify(data, null, 2)}</pre>` : ''}
            `;
            
            debugElement.appendChild(logEntry);
            debugElement.scrollTop = debugElement.scrollHeight;
            
            // 最大50エントリーで制限
            while (debugElement.children.length > 50) {
                debugElement.removeChild(debugElement.firstChild);
            }
        }
    }

    getOrCreateDebugElement() {
        let debugElement = document.getElementById('debug-console');
        if (!debugElement) {
            debugElement = document.createElement('div');
            debugElement.id = 'debug-console';
            debugElement.className = 'debug-console';
            document.body.appendChild(debugElement);
        }
        return debugElement;
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        const debugElement = document.getElementById('debug-console');
        
        if (this.debugMode) {
            this.showDebugLog('info', 'デバッグモードを有効にしました');
            if (debugElement) debugElement.style.display = 'block';
        } else {
            if (debugElement) debugElement.style.display = 'none';
        }
        
        this.showMessage(`デバッグモード: ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    // ルーム関連のイベントハンドラー
    handleRoomCreated(data) {
        // ルーム作成の通知を受信した場合の処理
        console.log('Room created:', data);
    }

    handleRoomJoined(data) {
        // ルーム参加の通知を受信した場合の処理
        console.log('Room joined:', data);
    }

    handleRoomFull(data) {
        // ルーム満員の通知を受信した場合の処理
        this.showMessage('満席です');
    }

    handleParticipantJoined(data) {
        if (this.currentRole === 'questioner' && data.role === 'answerer') {
            // 回答者が参加した場合、質問者の待機状態を解除
            this.isAnswererConnected = true;
            document.getElementById('waiting-message').classList.add('hidden');
            document.getElementById('questioner-content').classList.remove('hidden');
            this.showMessage('回答者が参加しました');
        }
    }

    // 新しいBluetoothメソッド
    generateDeviceId() {
        return 'device_' + Math.random().toString(36).substr(2, 9);
    }

    handleConnectionEstablished(data) {
        console.log('Connection established with device:', data.deviceId);
        this.connectedDevices.push(data.deviceId);
        this.reconnectAttempts = 0; // 再接続カウンターをリセット
    }

    onBluetoothDisconnected() {
        console.log('Bluetooth device disconnected');
        this.showMessage('Bluetooth接続が切断されました');
        
        // 再接続を試行
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnection();
        } else {
            this.showMessage('再接続に失敗しました。手動で再接続してください。');
            this.resetToBluetoothScreen();
        }
    }

    async attemptReconnection() {
        this.reconnectAttempts++;
        this.showMessage(`再接続を試行中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
            
            if (this.bluetoothDevice && this.bluetoothDevice.gatt) {
                this.bluetoothServer = await this.bluetoothDevice.gatt.connect();
                this.showMessage('再接続に成功しました');
                this.reconnectAttempts = 0;
            }
        } catch (error) {
            console.error('Reconnection failed:', error);
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => this.attemptReconnection(), 3000);
            } else {
                this.showMessage('再接続に失敗しました');
                this.resetToBluetoothScreen();
            }
        }
    }

    resetToBluetoothScreen() {
        // Bluetooth接続をリセット
        this.bluetoothDevice = null;
        this.bluetoothServer = null;
        this.bluetoothService = null;
        this.bluetoothTxCharacteristic = null;
        this.bluetoothRxCharacteristic = null;
        this.isAnswererConnected = false;
        this.connectedDevices = [];
        this.messageBuffer.clear();
        
        // 画面を接続方法選択画面に戻す
        this.showScreen('connection-screen');
    }

    // 接続方法選択
    selectConnectionMethod(method) {
        this.connectionMethod = method;
        this.showDebugLog('info', `接続方法を選択: ${method}`);
        
        if (method === 'bluetooth') {
            this.showScreen('bluetooth-screen');
        } else if (method === 'webrtc') {
            this.showScreen('qr-screen');
        }
    }

    // QRコードホスト開始
    async startQRHost() {
        try {
            this.showDebugLog('info', 'QRコードホストを開始');
            
            if (!this.webrtcManager) {
                this.webrtcManager = new WebRTCManager();
                this.webrtcManager.onMessage = (message) => this.processMessage(message);
                this.webrtcManager.onConnectionChange = (state) => this.handleWebRTCConnectionChange(state);
            }
            
            const connectionId = await this.webrtcManager.createHost();
            
            // QRコードを生成
            const canvas = document.getElementById('qr-canvas');
            if (!this.qrGenerator) {
                this.qrGenerator = new QRCodeGenerator(canvas);
            }
            this.qrGenerator.generate(connectionId);
            
            // 接続IDを表示
            document.getElementById('connection-id').textContent = connectionId;
            
            // デバッグ情報として接続IDとオファー情報を表示
            this.showDebugLog('info', `ホスト接続ID生成: ${connectionId}`);
            this.showDebugLog('info', 'LocalStorage keys after host creation:', Object.keys(localStorage));
            
            // 接続IDが確実に保存されているかチェック
            setTimeout(() => {
                const storedOffer = localStorage.getItem(`offer_${connectionId}`);
                if (storedOffer) {
                    this.showDebugLog('info', 'オファーが正常に保存されました');
                } else {
                    this.showDebugLog('error', 'オファーの保存に失敗しました');
                }
            }, 1000);
            
            // ホスト画面を表示
            document.getElementById('qr-role-selection').classList.add('hidden');
            document.getElementById('qr-host-section').classList.remove('hidden');
            
            this.showMessage(`接続ID: ${connectionId}`);
            
        } catch (error) {
            this.showDebugLog('error', 'QRコードホスト開始失敗', error);
            this.showMessage(`接続に失敗しました: ${error.message}`);
        }
    }

    // QRコードスキャン開始
    async startQRScan() {
        try {
            this.showDebugLog('info', 'QRコードスキャンを開始');
            
            const video = document.getElementById('camera-video');
            if (!this.qrScanner) {
                this.qrScanner = new QRCodeScanner(video);
            }
            
            const cameraStarted = await this.qrScanner.startCamera();
            if (!cameraStarted) {
                throw new Error('カメラにアクセスできません');
            }
            
            // スキャン画面を表示
            document.getElementById('qr-role-selection').classList.add('hidden');
            document.getElementById('qr-client-section').classList.remove('hidden');
            
            // QRコードスキャンを開始
            this.qrScanner.startScanning((connectionId) => {
                this.connectToQRHost(connectionId);
            });
            
        } catch (error) {
            this.showDebugLog('error', 'QRコードスキャン開始失敗', error);
            this.showMessage(`カメラエラー: ${error.message}`);
        }
    }

    // QRコードホストに接続
    async connectToQRHost(connectionId) {
        try {
            this.showDebugLog('info', `QRコードホストに接続: ${connectionId}`);
            
            if (!this.webrtcManager) {
                this.webrtcManager = new WebRTCManager();
                this.webrtcManager.onMessage = (message) => this.processMessage(message);
                this.webrtcManager.onConnectionChange = (state) => this.handleWebRTCConnectionChange(state);
            }
            
            await this.webrtcManager.connectToHost(connectionId);
            
            // カメラを停止
            if (this.qrScanner) {
                this.qrScanner.stopCamera();
            }
            
            document.getElementById('client-status').textContent = '接続しています...';
            
        } catch (error) {
            this.showDebugLog('error', 'QRコードホスト接続失敗', error);
            this.showMessage(`接続に失敗しました: ${error.message}`);
        }
    }

    // WebRTC接続状態変更
    handleWebRTCConnectionChange(state) {
        this.showDebugLog('info', `WebRTC接続状態: ${state}`);
        
        switch (state) {
            case 'connected':
                this.showMessage('接続が確立されました');
                this.showScreen('role-screen');
                break;
            case 'disconnected':
                this.showMessage('接続が切断されました');
                this.showScreen('connection-screen');
                break;
            case 'failed':
                this.showMessage('接続に失敗しました');
                this.showScreen('connection-screen');
                break;
        }
    }

    // カメラ切り替え
    async toggleCamera() {
        if (this.qrScanner) {
            await this.qrScanner.switchCamera();
        }
    }

    // 手動入力切り替え
    toggleManualInput() {
        const manualInput = document.getElementById('manual-input');
        const isHidden = manualInput.classList.contains('hidden');
        
        if (isHidden) {
            manualInput.classList.remove('hidden');
            document.getElementById('manual-input-btn').textContent = '手動入力を閉じる';
        } else {
            manualInput.classList.add('hidden');
            document.getElementById('manual-input-btn').textContent = '手動入力';
        }
    }

    // 手動接続
    async connectManually() {
        const connectionId = document.getElementById('manual-connection-id').value.trim().toUpperCase();
        if (!connectionId) {
            this.showMessage('接続IDを入力してください');
            return;
        }
        
        // 接続ID形式をチェック
        if (!/^[A-Z0-9]{6}$/.test(connectionId)) {
            this.showMessage('接続IDは6文字の英数字で入力してください');
            return;
        }
        
        this.showDebugLog('info', `手動入力による接続試行: ${connectionId}`);
        
        try {
            await this.connectToQRHost(connectionId);
        } catch (error) {
            this.showDebugLog('error', '手動接続失敗', error);
            
            // 利用可能な接続IDを表示
            if (this.webrtcManager) {
                const availableIds = this.webrtcManager.getAvailableConnectionIds();
                if (availableIds.length > 0) {
                    this.showMessage(`接続失敗: ${error.message}\n\n利用可能なID: ${availableIds.join(', ')}`);
                } else {
                    this.showMessage(`接続失敗: ${error.message}\n\nホスト側で接続を開始してください。`);
                }
            } else {
                this.showMessage(`接続失敗: ${error.message}`);
            }
        }
    }

    // メッセージ送信（統合版）
    async sendMessage(message) {
        if (this.connectionMethod === 'bluetooth') {
            await this.sendBluetoothMessage(message);
        } else if (this.connectionMethod === 'webrtc' && this.webrtcManager) {
            this.webrtcManager.sendMessage(message);
        } else {
            this.showDebugLog('warn', 'メッセージ送信失敗: 接続なし', message);
            this.showMessage('接続されていません');
        }
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new CommUApp();
});

// Service Worker登録 (PWA対応)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}