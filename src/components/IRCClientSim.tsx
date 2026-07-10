import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Send, Info, Users, HelpCircle } from 'lucide-react';
import { IRCMessage, IRCChannel } from '../types';

interface IRCClientSimProps {
  initialNick?: string;
  initialServer?: string;
  initialChannel?: string;
}

export default function IRCClientSim({
  initialNick = 'pIRCH_Guest',
  initialServer = 'irc.libera.chat',
  initialChannel = '#pyqt6',
}: IRCClientSimProps) {
  // Connection states
  const [server, setServer] = useState(initialServer);
  const [port, setPort] = useState('6667');
  const [nick, setNick] = useState(initialNick);
  const [targetChannel, setTargetChannel] = useState(initialChannel);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Chat log state
  const [currentRoom, setCurrentRoom] = useState<string>('Status');
  const [rooms, setRooms] = useState<Record<string, IRCChannel>>({
    Status: {
      name: 'Status',
      topic: 'IRC Client Connection Status Window',
      users: [],
      messages: [
        {
          id: 'welcome-0',
          timestamp: new Date().toLocaleTimeString(),
          sender: 'SYSTEM',
          text: '*** ยินดีต้อนรับสู่โปรแกรมจำลอง pyIRCH98 Client ***',
          type: 'info',
        },
        {
          id: 'welcome-1',
          timestamp: new Date().toLocaleTimeString(),
          sender: 'SYSTEM',
          text: 'นี่คือระบบจำลอง IRC Chat Client ในดีไซน์สุดคลาสสิกสไตล์ Windows 95 pIRCH98',
          type: 'info',
        },
        {
          id: 'welcome-2',
          timestamp: new Date().toLocaleTimeString(),
          sender: 'SYSTEM',
          text: 'กรุณากรอก Nick, Server ด้านบน แล้วกดปุ่ม "Connect" เพื่อเริ่มจำลองการเชื่อมต่อจริง',
          type: 'info',
        },
      ],
      unreadCount: 0,
    },
  });

  // Message input state
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages or room changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rooms, currentRoom]);

  // Bot response simulator
  const simulatedBotNicks = ['PyQt6_Fan', 'Python_Expert', 'ClassicChatter', 'MemeLord', 'RetroUser'];
  const botQuotes = [
    'ชอบดีไซน์หน้าต่างสีเทาแบบนี้จัง เหมือนกลับไปยุค Windows 95 เลยนะ',
    'สำหรับการสร้าง IRC Client ด้วย PyQt6 แนะนำให้ใช้ QThread ในการดึง socket.recv() จะทำให้ GUI ลื่นไหลมาก',
    'คำสั่ง /join #ชื่อห้อง เป็นสเน่ห์ของ IRC เสมอเลยนะ ฮ่าๆ',
    'คุณรู้ไหมว่า pIRCH เคยเป็นโปรแกรม IRC Client ที่ฮิตมากคู่คี่มากับ mIRC ในช่วงยุค 90s-2000s',
    'ถ้าต้องการคอมไพล์โค้ด Python PyQt6 ตัวนี้ แนะนำให้ใช้ PyInstaller รันด้วยคำสั่ง pyinstaller --onefile --windowed irc_client.py นะครับ สะดวกสุดๆ',
    'ลองพิมพ์คุยกับผมได้นะ หรือใช้คำสั่ง /help เพื่อดูคำสั่งทั้งหมดสิ!',
    'สเน่ห์ของการแชทแบบ TCP Socket คือการรับส่งข้อมูลแบบ Real-time ดิบๆ เลย ไม่ต้องผ่าน REST API คูลมาก!',
  ];

  const greetingReplies = [
    'สวัสดีครับคุณ {user}! ยินดีต้อนรับสู่ห้องแชทจำลองครับ ดีใจที่คุณแวะมาลองเล่นนะ!',
    'ยินดีต้อนรับ {user}! กำลังสนใจเขียนโปรแกรม Chat Client ด้วย PyQt6 อยู่หรือเปล่าครับ?',
    'หวัดดีคุณ {user} มีอะไรคุยกันได้นะ สเปซนี้สำหรับคนรักสไตล์ Retro และ Python PyQt6 เลย!',
  ];

  const pyqtReplies = [
    'ใช่ครับ! PyQt6 นั้นพัฒนาต่อยอดมาจาก Qt6 รองรับฟังก์ชันใหม่ๆ และการจัดการเธรดที่มีประสิทธิภาพมาก',
    'เทคนิคสำคัญใน PyQt6: ห้ามรันลูปรับค่าเครือข่ายใน thread หลักเด็ดขาด เพราะจะทำให้วิดเจ็ตต่างๆ ไม่ตอบสนอง และวินโดว์ขึ้น (Not Responding) ทันที',
    'ในโค้ดตัวอย่างของเรา ใช้ระบบ Signal-Slot ของ PyQt6 เพื่อส่งต่อข้อความระหว่าง Network Thread และ UI ได้อย่างปลอดภัยและง่ายดาย',
  ];

  const threadReplies = [
    'โครงสร้างเธรดใน Python มีทั้งแบบ threading.Thread และ QThread ของ PyQt. ในการพัฒนาแอป GUI แนะนำให้ใช้ QThread เพราะมันประสานงานกับ Widget อื่นๆ ของ Qt ได้ราบรื่นที่สุดครับ',
    'เธรดเสริม (Worker Thread) จะคอยสแตนด์บายอ่านข้อมูลจาก socket ตลอดเวลา ถ้ามีข้อมูลใหม่เข้ามา มันจะยิง Signal ไปปลุกหน้าจอหลักให้วาดข้อความขึ้นทันที',
  ];

  // Auto-simulated chatting loop
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      // Find an active channel room
      const activeChannels = Object.keys(rooms).filter((r) => r !== 'Status');
      if (activeChannels.length === 0) return;

      const randomChannelName = activeChannels[Math.floor(Math.random() * activeChannels.length)];
      const randomBot = simulatedBotNicks[Math.floor(Math.random() * simulatedBotNicks.length)];
      const randomQuote = botQuotes[Math.floor(Math.random() * botQuotes.length)];

      addMessageToRoom(randomChannelName, randomBot, randomQuote, 'user');
    }, 15000); // Send message every 15 seconds

    return () => clearInterval(interval);
  }, [isConnected, rooms]);

  const addMessageToRoom = (
    roomName: string,
    sender: string,
    text: string,
    type: IRCMessage['type'] = 'user'
  ) => {
    const newMessage: IRCMessage = {
      id: `${roomName}-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      sender,
      text,
      type,
    };

    setRooms((prev) => {
      const room = prev[roomName];
      if (!room) return prev;
      return {
        ...prev,
        [roomName]: {
          ...room,
          messages: [...room.messages, newMessage],
          unreadCount: roomName !== currentRoom ? room.unreadCount + 1 : 0,
        },
      };
    });
  };

  // Simulate IRC connection sequence
  const handleConnect = () => {
    if (isConnected) {
      // Disconnect action
      setIsConnected(false);
      setIsConnecting(false);
      
      // Keep only Status room and reset it
      setRooms({
        Status: {
          name: 'Status',
          topic: 'IRC Client Connection Status Window',
          users: [],
          messages: [
            ...rooms.Status.messages,
            {
              id: `disconnect-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              sender: 'SYSTEM',
              text: `*** ตัดการเชื่อมต่อจากเซิร์ฟเวอร์ ${server} เรียบร้อยแล้ว.`,
              type: 'system',
            },
          ],
          unreadCount: 0,
        },
      });
      setCurrentRoom('Status');
      return;
    }

    // Connect action
    setIsConnecting(true);
    setCurrentRoom('Status');

    // Sequence of connecting logs
    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `กำลังพยายามเปิด Socket เชื่อมต่อไปยัง ${server} พอร์ต ${port}...`, 'system');
    }, 400);

    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `เชื่อมต่อสำเร็จ! กำลังส่งสัญญานระบุตัวตน (NICK & USER)...`, 'system');
    }, 1000);

    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `-> NICK ${nick}`, 'info');
      addMessageToRoom('Status', 'SYSTEM', `-> USER pyIRCH 0 * :PyQt6 pIRCH Client`, 'info');
    }, 1500);

    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `ต้อนรับเข้าระบบ (RPL_WELCOME 001): ยินดีต้อนรับเข้าสู่เครือข่าย IRC!`, 'motd');
      addMessageToRoom('Status', 'SYSTEM', `[MOTD] - ยินดีต้อนรับสู่เซิร์ฟเวอร์ IRC จำลองความเสถียรสูง`, 'motd');
      addMessageToRoom('Status', 'SYSTEM', `[MOTD] - พัฒนาจำลองขึ้นมาเพื่อให้ทดสอบ UI pIRCH และช่วยทำโค้ด PyQt6 ติดตั้งได้สะดวก`, 'motd');
      addMessageToRoom('Status', 'SYSTEM', `[MOTD] - เธรดเครือข่ายถูกแยกไว้ในคลาส IRCWorker เรียบร้อยแล้ว`, 'motd');
    }, 2200);

    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      addMessageToRoom('Status', 'SYSTEM', `เชื่อมต่อสถานะออนไลน์สมบูรณ์! กำลังเข้าร่วมห้องแชทอัตโนมัติ: ${targetChannel}`, 'system');
      
      // Create and switch to target channel
      joinChannel(targetChannel);
    }, 2800);
  };

  const joinChannel = (chanName: string) => {
    const formattedChan = chanName.startsWith('#') ? chanName : `#${chanName}`;
    
    setRooms((prev) => {
      // If already in room, do nothing
      if (prev[formattedChan]) return prev;

      return {
        ...prev,
        [formattedChan]: {
          name: formattedChan,
          topic: `ห้องพูดคุยเกี่ยวกับ ${formattedChan} และการเขียนโปรแกรม PyQt6`,
          users: [nick, ...simulatedBotNicks],
          messages: [
            {
              id: `join-${formattedChan}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              sender: 'SYSTEM',
              text: `*** คุณ (${nick}) เข้าร่วมห้องแชท ${formattedChan} เรียบร้อยแล้ว`,
              type: 'join',
            },
            {
              id: `topic-${formattedChan}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              sender: 'SYSTEM',
              text: `* หัวข้อห้องแชท: ห้องพูดคุยเกี่ยวกับ ${formattedChan} และสไตล์การตกแต่ง Retro ด้วย Python PyQt6!`,
              type: 'info',
            },
          ],
          unreadCount: 0,
        },
      };
    });

    setCurrentRoom(formattedChan);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    setInputValue('');

    // Handle commands starting with '/'
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0].toUpperCase();
      const args = parts.slice(1).join(' ');

      addMessageToRoom(currentRoom, 'SYSTEM', `-> ${text}`, 'info');

      if (command === 'JOIN') {
        if (!args) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อห้องแชท เช่น /join #pyqt6', 'error');
          return;
        }
        if (!isConnected) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาทำการเชื่อมต่อเซิร์ฟเวอร์ก่อน!', 'error');
          return;
        }
        joinChannel(args);
      } else if (command === 'NICK') {
        if (!args) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อเล่นใหม่ เช่น /nick NewNick', 'error');
          return;
        }
        const oldNick = nick;
        setNick(args);
        
        // Log nick change in all rooms
        Object.keys(rooms).forEach((r) => {
          addMessageToRoom(r, 'SYSTEM', `*** ${oldNick} เปลี่ยนชื่อเป็น ${args}`, 'system');
          // Update users list in rooms
          setRooms((prev) => {
            const currentRoomObj = prev[r];
            if (!currentRoomObj) return prev;
            return {
              ...prev,
              [r]: {
                ...currentRoomObj,
                users: currentRoomObj.users.map((u) => (u === oldNick ? args : u)),
              },
            };
          });
        });
      } else if (command === 'PART' || command === 'LEAVE') {
        if (currentRoom === 'Status') {
          addMessageToRoom(currentRoom, 'SYSTEM', 'ไม่สามารถออกจากหน้าต่าง Status ได้', 'error');
          return;
        }
        const leavingRoom = currentRoom;
        setCurrentRoom('Status');
        setRooms((prev) => {
          const next = { ...prev };
          delete next[leavingRoom];
          return next;
        });
        addMessageToRoom('Status', 'SYSTEM', `ออกจากห้อง ${leavingRoom} เรียบร้อยแล้ว`, 'part');
      } else if (command === 'HELP') {
        addMessageToRoom(currentRoom, 'SYSTEM', '=== คำสั่ง IRC จำลองที่รองรับในระบบ ===', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/join #ชื่อห้อง - เข้าร่วมห้องแชทใหม่', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/nick ชื่อใหม่ - เปลี่ยนชื่อเล่นของคุณ', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/leave - ออกจากห้องแชทปัจจุบัน', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/help - เปิดคู่มือคำสั่งช่วยเหลือนี้', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/me ข้อความการกระทำ - ส่งข้อความสถานะการกระทำ', 'info');
      } else if (command === 'ME') {
        if (currentRoom === 'Status') {
          addMessageToRoom(currentRoom, 'SYSTEM', 'คำสั่งนี้ต้องใช้ในห้องแชทเท่านั้น', 'error');
          return;
        }
        addMessageToRoom(currentRoom, nick, `* ${nick} ${args}`, 'info');
      } else {
        addMessageToRoom(currentRoom, 'SYSTEM', `ไม่รู้จักคำสั่ง /${command} (พิมพ์ /help เพื่อดูคำสั่งทั้งหมด)`, 'error');
      }
      return;
    }

    // Normal message
    if (currentRoom === 'Status') {
      addMessageToRoom('Status', 'SYSTEM', 'หน้าต่างสถานะไม่สามารถพิมพ์ส่งข้อความได้ กรุณาเข้าร่วมห้องแชทหรือเชื่อมต่อก่อน', 'error');
      return;
    }

    addMessageToRoom(currentRoom, nick, text, 'user');

    // Bot Response trigger
    const lowerText = text.toLowerCase();
    let replyText = '';
    let chosenBot = simulatedBotNicks[Math.floor(Math.random() * simulatedBotNicks.length)];

    if (lowerText.includes('hello') || lowerText.includes('สวัสดี') || lowerText.includes('หวัดดี')) {
      const template = greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
      replyText = template.replace('{user}', nick);
      chosenBot = 'ClassicChatter';
    } else if (lowerText.includes('pyqt') || lowerText.includes('pyqt6') || lowerText.includes('qt')) {
      replyText = pyqtReplies[Math.floor(Math.random() * pyqtReplies.length)];
      chosenBot = 'Python_Expert';
    } else if (lowerText.includes('thread') || lowerText.includes('เธรด') || lowerText.includes('ค้าง')) {
      replyText = threadReplies[Math.floor(Math.random() * threadReplies.length)];
      chosenBot = 'PyQt6_Fan';
    } else if (lowerText.includes('pich') || lowerText.includes('pirch') || lowerText.includes('mirc')) {
      replyText = 'pIRCH98 ถือว่าเป็นโปรแกรม IRC ในตำนานของไทยเลยแหละ สมัยอินเทอร์เน็ตบ้าน 56k ใครๆ ก็ต้องเปิดช่อง #วัยรุ่น #สยามคุยกัน!';
      chosenBot = 'RetroUser';
    }

    if (replyText) {
      setTimeout(() => {
        addMessageToRoom(currentRoom, chosenBot, replyText, 'user');
      }, 1000 + Math.random() * 1000); // 1-2 sec response delay (natural feel)
    }
  };

  const getMessageColorClass = (type: IRCMessage['type']) => {
    switch (type) {
      case 'system':
        return 'text-[#008080] font-bold'; // Teal system
      case 'error':
        return 'text-[#ff0000] font-bold'; // Red error
      case 'motd':
        return 'text-[#800080]'; // Purple MOTD messages
      case 'join':
        return 'text-[#008000] font-semibold'; // Green joins
      case 'part':
        return 'text-[#808000]'; // Olive parts
      case 'info':
        return 'text-[#0000ff] font-sans italic'; // Blue system outputs
      default:
        return 'text-black'; // Black user messages
    }
  };

  const activeRoomData = rooms[currentRoom] || { messages: [], users: [] };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 win95-font">
      {/* 1. Top Input Panel (pIRCH layout - modern premium form style) */}
      <div className="bg-slate-100 border-b border-slate-200/80 p-2.5 flex flex-wrap gap-3 items-center mb-0.5 rounded-t-lg shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold whitespace-nowrap text-xs text-slate-600">Server:</span>
          <input
            type="text"
            value={server}
            onChange={(e) => !isConnected && !isConnecting && setServer(e.target.value)}
            disabled={isConnected || isConnecting}
            className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 px-2.5 py-1 w-[140px] text-xs outline-none font-mono rounded-md disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold whitespace-nowrap text-xs text-slate-600">Port:</span>
          <input
            type="text"
            value={port}
            onChange={(e) => !isConnected && !isConnecting && setPort(e.target.value)}
            disabled={isConnected || isConnecting}
            className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 px-2 py-1 w-[45px] text-xs text-center outline-none font-mono rounded-md disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold whitespace-nowrap text-xs text-slate-600">Nick:</span>
          <input
            type="text"
            value={nick}
            onChange={(e) => !isConnecting && setNick(e.target.value)}
            disabled={isConnecting}
            className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 px-2.5 py-1 w-[110px] text-xs outline-none font-mono rounded-md disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold whitespace-nowrap text-xs text-slate-600">Join Chan:</span>
          <input
            type="text"
            value={targetChannel}
            onChange={(e) => !isConnected && !isConnecting && setTargetChannel(e.target.value)}
            disabled={isConnected || isConnecting}
            placeholder="#channel"
            className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 px-2.5 py-1 w-[80px] text-xs outline-none font-mono rounded-md disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm"
          />
        </div>

        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={`flex items-center justify-center gap-1.5 px-4.5 py-1.5 text-xs font-bold ml-auto min-w-[100px] rounded-lg border transition-all duration-150 active:scale-95 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed ${
            isConnecting
              ? 'bg-slate-100 text-slate-400 border-slate-200'
              : isConnected
              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-sm'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm hover:shadow-indigo-500/10'
          }`}
          id="btn-irc-connect-sim"
        >
          {isConnecting ? (
            <span className="animate-pulse">Connecting...</span>
          ) : isConnected ? (
            <>
              <Square size={11} className="fill-current text-red-600" />
              <span>Disconnect</span>
            </>
          ) : (
            <>
              <Play size={11} className="fill-current text-white" />
              <span>Connect</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Channel Rooms Selector Tabs (Segmented bar style) */}
      <div className="flex bg-slate-100 border-b border-slate-200 p-1.5 gap-1 overflow-x-auto select-none">
        {Object.keys(rooms).map((roomName) => {
          const roomObj = rooms[roomName];
          const isSelected = roomName === currentRoom;
          return (
            <button
              key={roomName}
              onClick={() => {
                setCurrentRoom(roomName);
                // Reset unread count
                setRooms((prev) => ({
                  ...prev,
                  [roomName]: { ...prev[roomName], unreadCount: 0 },
                }));
              }}
              className={`px-3.5 py-1 font-sans text-xs font-semibold rounded-md transition-all relative cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              id={`tab-channel-${roomName.replace('#', '')}`}
            >
              <span>{roomName}</span>
              {roomObj.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[8px] font-bold px-1 py-0.5 animate-bounce shadow">
                  {roomObj.unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Room Topic bar */}
      <div className="bg-slate-50 border-b border-slate-200/60 py-1.5 px-3 flex items-center gap-2 text-xs text-slate-500">
        <Info size={13} className="text-indigo-500 shrink-0" />
        <span className="font-medium truncate">
          Topic: <span className="text-slate-700 font-normal">{activeRoomData.topic || 'No topic is set for this window'}</span>
        </span>
      </div>

      {/* 4. Chat Workspace & Nick List Panel (Split View) */}
      <div className="flex-1 min-h-0 flex gap-2 p-2 bg-slate-100">
        {/* Chat window */}
        <div className="flex-1 min-h-0 bg-white border border-slate-200/80 rounded-lg p-3.5 overflow-y-auto flex flex-col gap-1.5 font-mono text-[13px] leading-relaxed shadow-inner select-text">
          {activeRoomData.messages.map((msg) => (
            <div key={msg.id} className="flex gap-2 items-start hover:bg-slate-50/50 py-0.5 rounded px-1 transition-colors">
              <span className="text-slate-400 select-none text-[11px] pt-0.5 font-sans font-medium">[{msg.timestamp}]</span>
              <div className="flex-1">
                {msg.type === 'user' ? (
                  <span>
                    <strong className="text-indigo-600 font-bold mr-1.5">&lt;{msg.sender}&gt;</strong>
                    <span className="text-slate-800 whitespace-pre-wrap">{msg.text}</span>
                  </span>
                ) : (
                  <span className={getMessageColorClass(msg.type)}>
                    {msg.text}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* User list pane */}
        {currentRoom !== 'Status' && (
          <div className="w-[150px] bg-white border border-slate-200/80 rounded-lg p-2 overflow-y-auto flex flex-col select-none shadow-inner">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2 px-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <Users size={11} className="text-slate-400" />
              <span>Users ({activeRoomData.users.length})</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {activeRoomData.users.map((username) => {
                const isMe = username === nick;
                const isOp = username === 'Python_Expert' || username === 'PyQt6_Fan';
                return (
                  <div
                     key={username}
                     className={`px-2 py-1 rounded-md text-xs flex items-center justify-between font-sans transition-colors ${
                       isMe ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                     }`}
                  >
                    <span className="truncate">
                      {isOp ? `@${username}` : username}
                    </span>
                    {isOp && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.2 rounded scale-95 shadow-sm">
                        OP
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Message input bar */}
      <form onSubmit={handleSendMessage} className="bg-slate-100 border-t border-slate-200 p-2.5 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            currentRoom === 'Status'
              ? 'ไม่สามารถส่งข้อความที่นี่ได้ (กรุณาดับเบิ้ลคลิกเพื่อสลับไปหน้าห้องแชทจำลอง)'
              : 'พิมพ์ข้อความคุยกับบอท หรือรันคำสั่ง เช่น /join #pyqt6, /nick Somchai จากนั้นกด Enter...'
          }
          disabled={!isConnected && currentRoom !== 'Status'}
          className="flex-1 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3.5 py-2 rounded-lg text-xs outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm"
          id="irc-message-input"
        />
        <button
          type="submit"
          disabled={(!isConnected && currentRoom !== 'Status') || !inputValue.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 px-5 font-bold text-xs rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
          id="btn-irc-send"
        >
          <Send size={12} />
          <span>Send</span>
        </button>
      </form>

      {/* 6. Client Status Bar */}
      <div className="bg-slate-50 border-t border-slate-200 py-2 px-3 flex justify-between text-[11px] text-slate-500 select-none">
        <div className="flex gap-4">
          <span className="font-bold">
            Status:{' '}
            <span className={isConnected ? 'text-emerald-600 font-bold' : isConnecting ? 'text-amber-500 animate-pulse font-bold' : 'text-slate-400 font-medium'}>
              {isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING...' : 'OFFLINE'}
            </span>
          </span>
          {isConnected && (
            <div className="hidden md:flex gap-4">
              <span>
                Server: <strong className="font-mono text-slate-600 font-medium">{server}</strong>
              </span>
              <span>
                Room: <strong className="text-indigo-600 font-mono font-medium">{currentRoom}</strong>
              </span>
              <span>
                Nick: <strong className="font-mono text-slate-600 font-medium">{nick}</strong>
              </span>
            </div>
          )}
        </div>
        <div>
          <span>Local Time: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
