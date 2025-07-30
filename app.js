class CommUApp {
    constructor() {
        this.isHost = false;
        this.currentRole = null;
        this.currentRoom = null;
        this.chatHistory = []; // 現在の部屋のチャット履歴
        this.roomChatHistory = {}; // 部屋ごとのチャット履歴を管理
        this.roomPasswords = {}; // 部屋ごとのパスワードを管理
        this.currentPassword = ''; // 現在設定中のパスワード
        this.currentSetupPassword = ''; // パスワード設定画面での入力中パスワード
        this.pendingRoomId = ''; // パスワード設定待ちのルームID
        this.targetRoomId = ''; // パスワード入力画面で対象となる部屋ID
        this.hasActiveQuestion = false; // 現在質問があるかどうか
        this.answerButtonTexts = {
            yes: ['はい', 'うん', 'もちろん！'],
            no: ['いいえ', 'ううん', 'やだ！']
        };
        this.currentAnswerIndex = {
            yes: 0,
            no: 0
        };
        this.roomParticipants = {}; // ルーム参加者管理
        this.roomStatus = {}; // 部屋の詳細状態管理
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

        // 回答変更ボタン
        document.getElementById('change-yes').addEventListener('click', () => this.changeAnswerText('yes'));
        document.getElementById('change-no').addEventListener('click', () => this.changeAnswerText('no'));

        // 音響モード
        document.getElementById('back-from-sound').addEventListener('click', () => this.showScreen('connection-screen'));
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
        document.getElementById('sound-mode-connection').addEventListener('click', () => this.showScreen('sound-mode-screen'));
        
        // 接続解除ボタン
        document.getElementById('disconnect-btn').addEventListener('click', () => this.confirmDisconnect());
        
        // キャッシュクリアボタン
        document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCacheAndReload());

        // P2P接続
        document.getElementById('p2p-host-btn').addEventListener('click', () => this.startP2PHost());
        document.getElementById('p2p-connect-btn').addEventListener('click', () => this.showP2PConnect());
        document.getElementById('back-from-p2p').addEventListener('click', () => this.showScreen('connection-screen'));
        document.getElementById('connect-peer-btn').addEventListener('click', () => this.connectToPeer());
        
        // P2P接続キャンセル
        document.getElementById('cancel-host-btn').addEventListener('click', () => this.cancelP2PConnection());
        document.getElementById('cancel-client-btn').addEventListener('click', () => this.cancelP2PConnection());

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
            case 'participant_joined':
                this.handleParticipantJoined(message.data);
                break;
            case 'connection_established':
                this.handleConnectionEstablished(message.data);
                break;
            case 'participant_left':
                this.handleParticipantLeft(message.data);
                break;
            case 'disconnect_notification':
                this.handleDisconnectNotification(message.data);
                break;
        }
    }



    selectRole(role) {
        this.currentRole = role;
        
        switch (role) {
            case 'questioner':
                this.startAsQuestioner();
                break;
            case 'answerer':
                this.startAsAnswerer();
                break;
        }
    }

    selectConnectionRole() {
        // P2P接続の役割を選択（接続確立前）
        this.showScreen('p2p-screen');
        document.getElementById('p2p-role-selection').classList.remove('hidden');
        document.getElementById('p2p-host-section').classList.add('hidden');
        document.getElementById('p2p-client-section').classList.add('hidden');
    }

    // 質問者として開始（P2P接続成功後）
    startAsQuestioner() {
        if (!this.p2pManager || !this.p2pManager.peerId) {
            this.showMessage('P2P接続が確立されていません');
            this.showScreen('connection-screen');
            return;
        }
        
        const peerId = this.p2pManager.peerId;
        
        // ピアIDをルームIDとして使用
        this.currentRoom = peerId;
        
        // ルーム参加者を初期化（質問者として登録）
        this.roomParticipants[peerId] = {
            questioner: { deviceId: 'host', connected: true },
            answerer: null,
            participantCount: 1
        };
        
        document.getElementById('current-room-id').textContent = peerId;
        this.showScreen('questioner-screen');
        
        this.showMessage(`質問者として開始しました\nピアID: ${peerId}`);
    }

    // 回答者として開始（P2P接続成功後）
    startAsAnswerer() {
        if (!this.p2pManager || !this.p2pManager.connection) {
            this.showMessage('P2P接続が確立されていません');
            this.showScreen('connection-screen');
            return;
        }
        
        // 接続先のピアIDをルームIDとして使用
        const peerId = this.p2pManager.connection.peer;
        this.currentRoom = peerId;
        
        // ルーム参加者情報を更新
        this.roomParticipants[peerId] = {
            questioner: { deviceId: 'host', connected: true },
            answerer: { deviceId: 'answerer', connected: true },
            participantCount: 2
        };
        
        document.getElementById('current-room-id-answerer').textContent = peerId;
        this.showScreen('answerer-screen');
        
        // 質問が来るまではメッセージ送信は有効、回答ボタンは無効
        document.getElementById('answerer-content').classList.remove('hidden');
        document.getElementById('waiting-question').classList.remove('hidden');
        this.disableAnswerButtons();
        this.enableMessageSending();
        
        // 質問者に参加通知を送信
        this.sendMessage({
            type: 'participant_joined',
            data: { roomId: peerId, role: 'answerer' }
        });
        
        this.showMessage('回答者として質問者に接続しました');
    }

    
    // 部屋を切り替える際のチャット履歴管理
    switchToRoom(roomId) {
        // 現在の部屋のチャット履歴を保存
        if (this.currentRoom && this.chatHistory.length > 0) {
            this.roomChatHistory[this.currentRoom] = [...this.chatHistory];
        }
        
        // 新しい部屋に切り替え
        this.currentRoom = roomId;
        
        // 新しい部屋のチャット履歴を復元（なければ空の配列）
        this.chatHistory = this.roomChatHistory[roomId] || [];
        
        // チャット履歴の表示を更新
        this.updateChatHistoryDisplay();
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
        
        // 質問が来たことを記録
        this.hasActiveQuestion = true;
        
        // 回答ボタンを有効化
        this.enableAnswerButtons();
        
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
        // 質問がない時は回答できない
        if (!this.hasActiveQuestion) {
            this.showMessage('質問をお待ちください');
            return;
        }
        
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
        
        // 回答後に質問をリセット
        this.resetQuestion();
    }

    sendTextAnswer() {
        // 質問がない時は回答できない
        if (!this.hasActiveQuestion) {
            this.showMessage('質問をお待ちください');
            return;
        }
        
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
        
        // 回答後に質問をリセット
        this.resetQuestion();
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

    // 回答テキストを変更
    changeAnswerText(buttonType) {
        // 次のテキストに切り替え
        this.currentAnswerIndex[buttonType] = (this.currentAnswerIndex[buttonType] + 1) % this.answerButtonTexts[buttonType].length;
        
        // ボタンのテキストを更新
        const buttonElement = document.getElementById(`answer-${buttonType}`);
        buttonElement.textContent = this.answerButtonTexts[buttonType][this.currentAnswerIndex[buttonType]];
        
        this.showMessage(`「${buttonType === 'yes' ? 'はい' : 'いいえ'}」ボタンを「${this.answerButtonTexts[buttonType][this.currentAnswerIndex[buttonType]]}」に変更しました`);
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
        // ルーム退出時に参加者情報を更新
        if (this.currentRoom && this.roomParticipants[this.currentRoom]) {
            if (role === 'questioner') {
                this.roomParticipants[this.currentRoom].questioner = null;
                this.roomParticipants[this.currentRoom].participantCount--;
            } else if (role === 'answerer') {
                this.roomParticipants[this.currentRoom].answerer = null;
                this.roomParticipants[this.currentRoom].participantCount--;
            }
            
            // 参加者がいなくなったらルーム情報を削除
            if (this.roomParticipants[this.currentRoom].participantCount <= 0) {
                delete this.roomParticipants[this.currentRoom];
                delete this.roomChatHistory[this.currentRoom];
            }
            
            // 退出をP2P経由で通知
            this.sendMessage({
                type: 'participant_left',
                data: { roomId: this.currentRoom, role: role }
            });
        }
        
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

    handleParticipantLeft(data) {
        if (data.roomId && this.roomParticipants[data.roomId]) {
            if (data.role === 'questioner') {
                this.roomParticipants[data.roomId].questioner = null;
                this.roomParticipants[data.roomId].participantCount--;
                if (this.currentRole === 'answerer' && this.currentRoom === data.roomId) {
                    this.showMessage('質問者が退出しました');
                    this.resetQuestion();
                }
            } else if (data.role === 'answerer') {
                this.roomParticipants[data.roomId].answerer = null;
                this.roomParticipants[data.roomId].participantCount--;
                if (this.currentRole === 'questioner' && this.currentRoom === data.roomId) {
                    this.showMessage('回答者が退出しました');
                    this.isAnswererConnected = false;
                    document.getElementById('waiting-message').classList.remove('hidden');
                    document.getElementById('questioner-content').classList.add('hidden');
                }
            }
            
            // 参加者がいなくなったらルーム情報を削除
            if (this.roomParticipants[data.roomId].participantCount <= 0) {
                delete this.roomParticipants[data.roomId];
                delete this.roomChatHistory[data.roomId];
            }
        }
    }

    handleDisconnectNotification(data) {
        this.showMessage(data.message);
        this.disconnectAndReturnToTitle();
    }




    // 接続方法選択
    selectConnectionMethod(method) {
        this.connectionMethod = method;
        this.showDebugLog('info', `接続方法を選択: ${method}`);
        
        if (method === 'p2p') {
            this.selectConnectionRole();
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
            
            // 入力フィールドをクリア
            peerIdInput.value = '';
            
            // 接続成功後は handleP2PConnectionChange で役割選択画面に移動
            
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
                this.showMessage('P2P接続が確立されました\n役割を選んでください');
                // 接続確立後は役割選択画面に移動
                this.showScreen('role-screen');
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

    // P2P接続をキャンセル
    cancelP2PConnection() {
        this.showDebugLog('info', 'P2P接続をキャンセル');
        
        // P2P接続を破棄
        if (this.p2pManager) {
            try {
                if (this.p2pManager.peer) {
                    this.p2pManager.peer.destroy();
                }
                if (this.p2pManager.connection) {
                    this.p2pManager.connection.close();
                }
            } catch (error) {
                this.showDebugLog('warn', 'P2P接続破棄時のエラー:', error);
            }
            this.p2pManager = null;
        }
        
        // 接続画面に戻る
        this.showScreen('connection-screen');
        this.showMessage('P2P接続をキャンセルしました');
    }

    // 接続解除確認
    confirmDisconnect() {
        if (confirm('P2P接続を解除してタイトルに戻りますか？')) {
            this.disconnectAndReturnToTitle();
        }
    }

    // 接続解除してタイトルに戻る
    disconnectAndReturnToTitle() {
        this.showDebugLog('info', 'P2P接続を解除してタイトルに戻る');
        
        // 相手に切断通知を送信
        if (this.p2pManager && this.p2pManager.connection) {
            try {
                this.sendMessage({
                    type: 'disconnect_notification',
                    data: { message: '相手が接続を解除しました' }
                });
            } catch (error) {
                this.showDebugLog('warn', '切断通知送信失敗:', error);
            }
        }
        
        // P2P接続を破棄
        if (this.p2pManager) {
            try {
                if (this.p2pManager.peer) {
                    this.p2pManager.peer.destroy();
                }
                if (this.p2pManager.connection) {
                    this.p2pManager.connection.close();
                }
            } catch (error) {
                this.showDebugLog('warn', 'P2P接続破棄時のエラー:', error);
            }
            this.p2pManager = null;
        }
        
        // 状態をリセット
        this.currentRole = null;
        this.currentRoom = null;
        this.chatHistory = [];
        this.roomParticipants = {};
        this.roomChatHistory = {};
        
        // 接続画面に戻る
        this.showScreen('connection-screen');
        this.showMessage('接続を解除しました');
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
    
    // キャッシュクリア＆再読み込み
    clearCacheAndReload() {
        if (confirm('🗑️ キャッシュをクリアして最新版を取得しますか？\n\nページが自動的に再読み込みされます。')) {
            // バージョン状態をリセット
            const versionStatus = document.getElementById('version-status');
            if (versionStatus) {
                versionStatus.textContent = '確認中...';
                versionStatus.className = 'version-status';
            }
            
            if ('caches' in window) {
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            console.log('Deleting cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                    );
                }).then(() => {
                    console.log('All caches cleared');
                    // Service Workerもアンレジスタ
                    if ('serviceWorker' in navigator) {
                        return navigator.serviceWorker.getRegistrations().then(registrations => {
                            return Promise.all(registrations.map(registration => {
                                return registration.unregister();
                            }));
                        });
                    }
                }).then(() => {
                    window.location.reload(true);
                });
            } else {
                // Service Workerがサポートされていない場合も再読み込み
                window.location.reload(true);
            }
        }
    }
    
    // 回答ボタンを有効化
    enableAnswerButtons() {
        const answerButtons = ['answer-yes', 'answer-no', 'answer-maybe', 'answer-refuse'];
        answerButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
            }
        });
        
        const textAnswerBtn = document.getElementById('send-text-answer-btn');
        if (textAnswerBtn) {
            textAnswerBtn.disabled = false;
            textAnswerBtn.style.opacity = '1';
        }
        
        // 変更ボタンも有効化
        const changeButtons = ['change-yes', 'change-no'];
        changeButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
            }
        });
    }
    
    // 回答ボタンを無効化
    disableAnswerButtons() {
        const answerButtons = ['answer-yes', 'answer-no', 'answer-maybe', 'answer-refuse'];
        answerButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.style.opacity = '0.5';
            }
        });
        
        const textAnswerBtn = document.getElementById('send-text-answer-btn');
        if (textAnswerBtn) {
            textAnswerBtn.disabled = true;
            textAnswerBtn.style.opacity = '0.5';
        }
        
        // 変更ボタンも無効化
        const changeButtons = ['change-yes', 'change-no'];
        changeButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.style.opacity = '0.5';
            }
        });
    }
    
    // メッセージ送信を有効化
    enableMessageSending() {
        const messageBtn = document.getElementById('send-message-btn');
        const messageInput = document.getElementById('free-message-input');
        
        if (messageBtn) {
            messageBtn.disabled = false;
            messageBtn.style.opacity = '1';
        }
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.style.opacity = '1';
        }
    }
    
    // 質問をリセット
    resetQuestion() {
        this.hasActiveQuestion = false;
        
        // 質問表示をクリア
        const questionElement = document.getElementById('question-text');
        if (questionElement) {
            questionElement.textContent = '';
        }
        
        // 回答ボタンを無効化
        this.disableAnswerButtons();
        
        // 待機画面を表示
        document.getElementById('waiting-question').classList.remove('hidden');
        document.getElementById('answerer-content').classList.add('hidden');
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