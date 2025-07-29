class CommUApp {
    constructor() {
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
        this.connectionMethod = 'p2p'; // P2P通信のみ
        this.p2pManager = null; // P2P接続管理
        this.peerDiscovery = null; // ピア検索機能
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupBroadcastChannel();
        this.showScreen('connection-screen');
    }
    
    setupBroadcastChannel() {
        // BroadcastChannelでの通信を監視
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('commu_webrtc');
                channel.onmessage = (event) => {
                    this.handleBroadcastMessage(event.data);
                };
                this.broadcastChannel = channel;
                this.showDebugLog('info', 'BroadcastChannel setup completed');
            } catch (error) {
                this.showDebugLog('warn', 'BroadcastChannel setup failed:', error);
            }
        }
    }
    
    handleBroadcastMessage(data) {
        this.showDebugLog('info', 'Received broadcast message:', data);
        
        if (data.type === 'request_offer' && this.webrtcManager) {
            // 他のタブから接続ID要求を受信した場合、自分が持っているオファーを送信
            const offer = this.webrtcManager.getOfferFromLocalStorage(data.connectionId);
            if (offer && this.broadcastChannel) {
                this.broadcastChannel.postMessage({
                    type: 'webrtc_offer',
                    connectionId: data.connectionId,
                    offer: offer
                });
                this.showDebugLog('info', 'Sent offer via broadcast for:', data.connectionId);
            }
        }
    }

    setupEventListeners() {

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
        document.getElementById('p2p-connection').addEventListener('click', () => this.selectConnectionMethod('p2p'));
        document.getElementById('back-to-connection').addEventListener('click', () => this.showScreen('connection-screen'));

        // P2P接続
        document.getElementById('p2p-host-btn').addEventListener('click', () => this.startP2PHost());
        document.getElementById('p2p-connect-btn').addEventListener('click', () => this.showP2PConnect());
        document.getElementById('back-from-p2p').addEventListener('click', () => this.showScreen('connection-screen'));
        document.getElementById('connect-peer-btn').addEventListener('click', () => this.connectToPeer());

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
        
        // ルーム作成をP2P経由で通知
        this.sendMessage({
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
        
        // ルーム参加をP2P経由で通知
        this.sendMessage({
            type: 'room_joined',
            data: { roomId: roomId, joinerRole: 'answerer' }
        });
        
        // 質問者に参加通知を送信
        this.sendMessage({
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

        // P2P経由で回答を送信
        this.sendMessage({
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

        // P2P経由で回答を送信
        this.sendMessage({
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

        // P2P経由でメッセージを送信
        this.sendMessage({
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


    handleConnectionEstablished(data) {
        console.log('Connection established with device:', data.deviceId);
        this.connectedDevices.push(data.deviceId);
        this.reconnectAttempts = 0; // 再接続カウンターをリセット
    }




    // 接続方法選択
    selectConnectionMethod(method) {
        this.connectionMethod = method;
        this.showDebugLog('info', `接続方法を選択: ${method}`);
        
        if (method === 'p2p') {
            this.showScreen('p2p-screen');
        }
    }

    // P2Pホスト開始
    async startP2PHost() {
        try {
            this.showDebugLog('info', 'P2Pホストを開始');
            
            if (!this.p2pManager) {
                this.p2pManager = new P2PManager();
                this.p2pManager.onMessage = (message) => this.processMessage(message);
                this.p2pManager.onConnectionChange = (state, error) => this.handleP2PConnectionChange(state, error);
            }
            
            const peerId = await this.p2pManager.createHost();
            
            // ピアIDを表示
            document.getElementById('peer-id').textContent = peerId;
            
            // デバッグ情報
            this.showDebugLog('info', `ホストピアID生成: ${peerId}`);
            this.showDebugLog('info', 'P2P接続待機中...');
            
            // ホスト画面を表示
            document.getElementById('p2p-role-selection').classList.add('hidden');
            document.getElementById('p2p-host-section').classList.remove('hidden');
            
            // ピア検索は手動接続のみに限定（自動検索を無効化）
            // 自動ピア検索はコンソールエラーの原因となるため無効化
            
            this.showMessage(`ピアID: ${peerId}\n他のデバイスからの接続を待っています`);
            
        } catch (error) {
            this.showDebugLog('error', 'P2Pホスト開始失敗', error);
            this.showMessage(`接続に失敗しました: ${error.message}`);
        }
    }

    // P2P接続画面を表示
    showP2PConnect() {
        this.showDebugLog('info', 'P2P接続画面を表示');
        
        // 接続画面を表示
        document.getElementById('p2p-role-selection').classList.add('hidden');
        document.getElementById('p2p-client-section').classList.remove('hidden');
        
        // 入力フィールドにフォーカス
        const peerIdInput = document.getElementById('peer-id-input');
        if (peerIdInput) {
            peerIdInput.focus();
        }
    }

    // ピアに接続
    async connectToPeer() {
        try {
            const peerIdInput = document.getElementById('peer-id-input');
            const targetPeerId = peerIdInput.value.trim();
            
            if (!targetPeerId) {
                this.showMessage('ピアIDを入力してください');
                return;
            }
            
            this.showDebugLog('info', `ピアに接続: ${targetPeerId}`);
            
            // ローディング状態を表示
            const statusElement = document.getElementById('client-status');
            if (statusElement) {
                statusElement.textContent = '接続中...';
            }
            
            if (!this.p2pManager) {
                this.p2pManager = new P2PManager();
                this.p2pManager.onMessage = (message) => this.processMessage(message);
                this.p2pManager.onConnectionChange = (state, error) => this.handleP2PConnectionChange(state, error);
            }
            
            // ピアに接続
            if (statusElement) {
                statusElement.textContent = 'P2P接続を確立中...';
            }
            
            await this.p2pManager.connectToPeer(targetPeerId);
            
            if (statusElement) {
                statusElement.textContent = '接続完了';
            }
            
            this.showDebugLog('info', '接続処理が完了しました');
            
            // 入力フィールドをクリア
            peerIdInput.value = '';
            
        } catch (error) {
            this.showDebugLog('error', 'ピア接続失敗', error);
            
            // エラー状態を表示
            const statusElement = document.getElementById('client-status');
            if (statusElement) {
                statusElement.textContent = '接続に失敗しました';
            }
            
            this.showMessage(`接続に失敗しました: ${error.message}`);
        }
    }

    // P2P接続状態変更
    handleP2PConnectionChange(state, errorMessage = null) {
        this.showDebugLog('info', `P2P接続状態: ${state}`);
        
        switch (state) {
            case 'connected':
                this.showMessage('P2P接続が確立されました');
                this.showScreen('role-screen');
                
                // P2P接続が成功したため、接続処理完了
                break;
                
            case 'disconnected':
                this.showMessage('P2P接続が切断されました');
                this.showScreen('connection-screen');
                break;
                
            case 'failed':
            case 'error':
                const message = errorMessage || 'P2P接続に失敗しました';
                this.showMessage(message);
                this.showScreen('connection-screen');
                break;
                
            case 'waiting':
                this.showDebugLog('info', '接続待機中...');
                break;
                
            case 'connecting':
                this.showDebugLog('info', '接続中...');
                break;
        }
    }

    // P2P接続の詳細情報を表示
    showP2PDebugInfo() {
        if (this.p2pManager && this.debugMode) {
            const debugInfo = this.p2pManager.getDebugInfo();
            this.showDebugLog('info', 'P2P Debug Info:', debugInfo);
        }
    }

    // メッセージ送信（P2Pのみ）
    async sendMessage(message) {
        if (this.connectionMethod === 'p2p' && this.p2pManager) {
            const success = this.p2pManager.sendMessage(message);
            if (!success) {
                this.showDebugLog('warn', 'P2Pメッセージ送信失敗', message);
                this.showMessage('メッセージの送信に失敗しました');
            }
        } else {
            this.showDebugLog('warn', 'メッセージ送信失敗: P2P接続なし', message);
            this.showMessage('P2P接続されていません');
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