import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Send, Info, Users, HelpCircle, Sun, Moon, Radio, Volume2, VolumeX, Music, Activity, Bell, BellOff, AtSign, MessageSquare, Paperclip } from 'lucide-react';
import { IRCMessage, IRCChannel } from '../types';

interface IRCClientSimProps {
  initialNick?: string;
  initialServer?: string;
  initialChannel?: string;
}

const MIRC_COLORS: { [key: number]: string } = {
  0: '#ffffff', // White
  1: '#000000', // Black
  2: '#00007f', // Blue
  3: '#009300', // Green
  4: '#ff0000', // Red
  5: '#7f0000', // Brown
  6: '#9c009c', // Purple
  7: '#fc7f00', // Orange
  8: '#ffff00', // Yellow
  9: '#00fc00', // Light Green
  10: '#009393', // Cyan
  11: '#00fcfc', // Light Cyan
  12: '#0000fc', // Light Blue
  13: '#ff00ff', // Pink
  14: '#7f7f7f', // Grey
  15: '#d2d2d2', // Light Grey
};

const getMircColor = (colorNum: number, isDark: boolean): string => {
  if (isDark) {
    const darkColors: { [key: number]: string } = {
      0: '#ffffff', // White
      1: '#94a3b8', // Black -> Slate-400
      2: '#60a5fa', // Blue -> Blue-400
      3: '#4ade80', // Green -> Green-400
      4: '#f87171', // Red -> Red-400
      5: '#fb923c', // Brown -> Orange-400
      6: '#c084fc', // Purple -> Purple-400
      7: '#f59e0b', // Orange -> Amber-500
      8: '#facc15', // Yellow -> Yellow-400
      9: '#86efac', // Light Green -> Green-300
      10: '#2dd4bf', // Cyan -> Teal-400
      11: '#22d3ee', // Light Cyan -> Cyan-400
      12: '#93c5fd', // Light Blue -> Blue-300
      13: '#f472b6', // Pink -> Pink-400
      14: '#cbd5e1', // Grey -> Slate-300
      15: '#e2e8f0', // Light Grey -> Slate-200
    };
    return darkColors[colorNum] || '#ffffff';
  } else {
    const lightColors: { [key: number]: string } = {
      0: '#334155', // White -> Slate-700
      1: '#000000', // Black
      2: '#1d4ed8', // Blue -> Blue-750
      3: '#15803d', // Green -> Green-700
      4: '#b91c1c', // Red -> Red-700
      5: '#7c2d12', // Brown -> Orange-900
      6: '#7e22ce', // Purple -> Purple-700
      7: '#c2410c', // Orange -> Orange-700
      8: '#a16207', // Yellow -> Yellow-700
      9: '#166534', // Light Green -> Green-800
      10: '#0f766e', // Cyan -> Teal-700
      11: '#0369a1', // Light Cyan -> Cyan-700
      12: '#1e40af', // Light Blue -> Blue-800
      13: '#be185d', // Pink -> Pink-700
      14: '#4b5563', // Grey -> Grey-600
      15: '#374151', // Light Grey -> Grey-700
    };
    return lightColors[colorNum] || '#000000';
  }
};

interface TextSegment {
  text: string;
  bold: boolean;
  underline: boolean;
  fgColor: string | null;
  bgColor: string | null;
}

function preprocessFormattingText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\^B/g, '\x02')
    .replace(/\^b/g, '\x02')
    .replace(/\^U/g, '\x1F')
    .replace(/\^u/g, '\x1F')
    .replace(/\^O/g, '\x0F')
    .replace(/\^o/g, '\x0F')
    .replace(/\^C/g, '\x03')
    .replace(/\^c/g, '\x03')
    .replace(/&B/gi, '\x02')
    .replace(/&U/gi, '\x1F')
    .replace(/&O/gi, '\x0F')
    .replace(/&C/gi, '\x03');
}

function parseMIRCText(text: string, isDark: boolean): TextSegment[] {
  const cleanText = preprocessFormattingText(text);
  const segments: TextSegment[] = [];
  let currentText = '';
  let bold = false;
  let underline = false;
  let fgColor: string | null = null;
  let bgColor: string | null = null;

  const pushSegment = () => {
    if (currentText) {
      segments.push({
        text: currentText,
        bold,
        underline,
        fgColor,
        bgColor
      });
      currentText = '';
    }
  };

  let i = 0;
  while (i < cleanText.length) {
    const char = cleanText[i];
    if (char === '\x02') {
      pushSegment();
      bold = !bold;
      i++;
    } else if (char === '\x1F') {
      pushSegment();
      underline = !underline;
      i++;
    } else if (char === '\x0F') {
      pushSegment();
      bold = false;
      underline = false;
      fgColor = null;
      bgColor = null;
      i++;
    } else if (char === '\x03') {
      pushSegment();
      i++; // skip '\x03'
      
      let fgStr = '';
      if (i < cleanText.length && /\d/.test(cleanText[i])) {
        fgStr += cleanText[i];
        i++;
        if (i < cleanText.length && /\d/.test(cleanText[i])) {
          fgStr += cleanText[i];
          i++;
        }
      }
      
      let bgStr = '';
      if (i < cleanText.length && cleanText[i] === ',') {
        if (i + 1 < cleanText.length && /\d/.test(cleanText[i + 1])) {
          i++; // skip ','
          bgStr += cleanText[i];
          i++;
          if (i < cleanText.length && /\d/.test(cleanText[i])) {
            bgStr += cleanText[i];
            i++;
          }
        }
      }

      if (fgStr) {
        const fgNum = parseInt(fgStr, 10);
        fgColor = getMircColor(fgNum, isDark);
      } else {
        fgColor = null;
        bgColor = null;
      }

      if (bgStr) {
        const bgNum = parseInt(bgStr, 10);
        bgColor = getMircColor(bgNum, isDark);
      }
    } else {
      currentText += char;
      i++;
    }
  }
  pushSegment();
  return segments;
}

interface ContentToken {
  type: 'text' | 'link';
  content: string;
}

function tokenizeLinks(text: string): ContentToken[] {
  const urlRegex = /(\bhttps?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const tokens: ContentToken[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const url = match[0];

    if (matchIndex > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, matchIndex)
      });
    }

    tokens.push({
      type: 'link',
      content: url
    });

    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }];
}

export function renderFormattedText(text: string, isDarkMode: boolean): React.ReactNode[] {
  if (!text) return [];
  const segments = parseMIRCText(text, isDarkMode);
  const result: React.ReactNode[] = [];
  let keyCounter = 0;

  segments.forEach((seg) => {
    const tokens = tokenizeLinks(seg.text);
    tokens.forEach((token) => {
      const styles: React.CSSProperties = {};
      if (seg.bold) styles.fontWeight = 'bold';
      if (seg.underline) styles.textDecoration = 'underline';
      if (seg.fgColor) styles.color = seg.fgColor;
      if (seg.bgColor) styles.backgroundColor = seg.bgColor;

      if (token.type === 'link') {
        const href = token.content.startsWith('www.') ? `http://${token.content}` : token.content;
        result.push(
          <a
            key={`link-${keyCounter++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 dark:text-indigo-400 underline hover:text-indigo-600 dark:hover:text-indigo-300 break-all cursor-pointer inline-flex items-center gap-0.5"
            style={{ fontWeight: seg.bold ? 'bold' : undefined, textDecoration: 'underline' }}
          >
            {token.content}
          </a>
        );
      } else {
        if (Object.keys(styles).length > 0) {
          result.push(
            <span key={`text-${keyCounter++}`} style={styles}>
              {token.content}
            </span>
          );
        } else {
          result.push(token.content);
        }
      }
    });
  });

  return result.length > 0 ? result : [text];
}

export default function IRCClientSim({
  initialNick = 'pIRCH_Guest',
  initialServer = 'irc.thaiirc.com',
  initialChannel = '#pyqt6',
}: IRCClientSimProps) {
  // Connection states
  const [server, setServer] = useState(initialServer);
  const [port, setPort] = useState('6667');
  const [nick, setNick] = useState(initialNick);
  const [targetChannel, setTargetChannel] = useState(initialChannel);
  const [password, setPassword] = useState('');
  const [useSSL, setUseSSL] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<string[]>(['python_expert', 'pyqt6_fan', 'classicchatter']);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mentionNotify, setMentionNotify] = useState<boolean>(true);

  // Online Radio states
  const [radioPlaying, setRadioPlaying] = useState<boolean>(false);
  const [currentStation, setCurrentStation] = useState<'mquest' | 'live' | null>(null);
  const [radioVolume, setRadioVolume] = useState<number>(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    const isImg = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      
      const timestamp = new Date().toLocaleTimeString();
      const newMessageId = `msg-${Date.now()}`;
      
      const fileMsg: IRCMessage = {
        id: newMessageId,
        timestamp,
        sender: nick,
        text: `[ส่งไฟล์สำเร็จ] 📎 ${file.name} (${sizeStr})`,
        type: 'user',
        fileUrl: dataUrl,
        fileName: file.name,
        fileSize: sizeStr,
        isImage: isImg
      };

      setRooms((prev) => {
        const room = prev[currentRoom];
        if (!room) return prev;
        return {
          ...prev,
          [currentRoom]: {
            ...room,
            messages: [...room.messages, fileMsg],
          },
        };
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => {
        const botName = currentRoom === '#pyqt6' ? 'Python_Expert' : 'PyQt6_Fan';
        const replyText = isImg 
          ? `โอ้! ได้รับรูปภาพ "${file.name}" เรียบร้อยแล้วครับ รูปภาพสวยงามและชัดเจนมาก! 🖼️✨`
          : `ได้รับไฟล์ "${file.name}" (${sizeStr}) เรียบร้อยแล้วครับ ขอบคุณสำหรับไฟล์ข้อมูล! 📂🤖`;
        
        const replyMsg: IRCMessage = {
          id: `msg-reply-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          sender: botName,
          text: replyText,
          type: 'user',
        };

        setRooms((prev) => {
          const room = prev[currentRoom];
          if (!room) return prev;
          return {
            ...prev,
            [currentRoom]: {
              ...room,
              messages: [...room.messages, replyMsg],
            },
          };
        });
      }, 1000);
    };

    reader.readAsDataURL(file);
  };
  
  // Font size setting state (sm = small, md = medium, lg = large)
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Helper to wash/strip prefix symbols from nicknames correctly
  const cleanNick = (name: string): string => {
    return name.replace(/^[@+%&~]+/, '');
  };

  // Add a user to a specific room if they don't already exist (deduplicating using washed nick)
  const addUserToRoom = (roomName: string, userToAdd: string) => {
    setRooms((prev) => {
      const room = prev[roomName];
      if (!room) return prev;
      
      const cleanNew = cleanNick(userToAdd);
      const exists = room.users.some(u => cleanNick(u) === cleanNew);
      if (exists) return prev;
      
      return {
        ...prev,
        [roomName]: {
          ...room,
          users: [...room.users, userToAdd],
        },
      };
    });
  };

  // Remove a user from a specific room (matching using washed nick)
  const removeUserFromRoom = (roomName: string, userToRemove: string) => {
    setRooms((prev) => {
      const room = prev[roomName];
      if (!room) return prev;
      
      const cleanTarget = cleanNick(userToRemove);
      return {
        ...prev,
        [roomName]: {
          ...room,
          users: room.users.filter(u => cleanNick(u) !== cleanTarget),
        },
      };
    });
  };

  // Remove a user from all rooms (e.g., on QUIT)
  const removeUserFromAllRooms = (userToRemove: string) => {
    const cleanTarget = cleanNick(userToRemove);
    setRooms((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((r) => {
        if (r === 'Status' || r === 'MOTD') return;
        next[r] = {
          ...next[r],
          users: next[r].users.filter(u => cleanNick(u) !== cleanTarget),
        };
      });
      return next;
    });
  };

  // Online Radio Effects & Handlers
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = radioVolume;
    }
  }, [radioVolume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleRadio = (station: 'mquest' | 'live') => {
    const isCurrentlyPlayingThis = radioPlaying && currentStation === station;

    if (isCurrentlyPlayingThis) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setRadioPlaying(false);
      setCurrentStation(null);
      addMessageToRoom('Status', 'SYSTEM', '*** หยุดเล่นวิทยุออนไลน์', 'system');
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const url = station === 'mquest'
        ? 'http://icecast.thaiirc.com:8000/ices'
        : 'http://radio.thaiirc.com:8002/ices';

      const stationName = station === 'mquest' ? 'MQuest Radio' : 'Live Radio';

      try {
        const audio = new Audio(url);
        audio.crossOrigin = 'anonymous';
        audio.volume = radioVolume;
        audioRef.current = audio;

        setRadioPlaying(true);
        setCurrentStation(station);

        audio.play().catch((err) => {
          console.warn('Audio play auto-blocked or failed:', err);
        });

        addMessageToRoom('Status', 'SYSTEM', `*** กำลังเปิดวิทยุออนไลน์: ${stationName} (${url})`, 'join');
      } catch (e) {
        console.error('Audio initialization error:', e);
      }
    }
  };

  const stopRadio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRadioPlaying(false);
    setCurrentStation(null);
    addMessageToRoom('Status', 'SYSTEM', '*** หยุดเล่นวิทยุออนไลน์เรียบร้อยแล้ว', 'system');
  };

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

  // Auto-simulated chatting and dynamic user events loop (JOIN, PART, KICK)
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      // Find an active channel room
      const activeChannels = Object.keys(rooms).filter((r) => r !== 'Status' && r !== 'MOTD');
      if (activeChannels.length === 0) return;

      const randomChannelName = activeChannels[Math.floor(Math.random() * activeChannels.length)];
      
      // Determine what event to simulate:
      // 0.0 - 0.60: Normal Chat Message (60%)
      // 0.60 - 0.75: User Join (15%)
      // 0.75 - 0.90: User Part (15%)
      // 0.90 - 1.00: User Kick (10%)
      const rand = Math.random();
      
      const joinPool = ['Somchai', 'Somsri', 'Supa', 'Anong', 'Kitti', 'Wichai', 'Nipa', 'Noppadon', 'Malai', 'Udom'];
      const prefixPool = ['@', '+', '', '']; // Chance of Op, Voice or normal
     const kickReasons = ['Spamming links', 'Flooding the chat', 'Off-topic discussion', 'Please keep it polite', 'Inappropriate nickname'];

      if (rand < 0.60) {
        // Normal Message
        const currentUsers = rooms[randomChannelName]?.users || [];
        if (currentUsers.length === 0) return;
        
        const possibleSenders = currentUsers.filter(u => cleanNick(u) !== cleanNick(nick));
        const senderWithPrefix = possibleSenders.length > 0 
          ? possibleSenders[Math.floor(Math.random() * possibleSenders.length)]
          : simulatedBotNicks[Math.floor(Math.random() * simulatedBotNicks.length)];
        
        const sender = cleanNick(senderWithPrefix);
        const randomQuote = botQuotes[Math.floor(Math.random() * botQuotes.length)];
        
        addMessageToRoom(randomChannelName, sender, randomQuote, 'user');
      } else if (rand < 0.75) {
        // User Join
        const randomNewNick = joinPool[Math.floor(Math.random() * joinPool.length)];
        const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
        const fullNick = prefix + randomNewNick;
        
        const currentUsers = rooms[randomChannelName]?.users || [];
        if (currentUsers.some(u => cleanNick(u) === randomNewNick)) return;

        addMessageToRoom(randomChannelName, 'SYSTEM', `*** ${fullNick} (${randomNewNick}@irc.thaiirc.com) has joined ${randomChannelName}`, 'join');
        addUserToRoom(randomChannelName, fullNick);
      } else if (rand < 0.90) {
        // User Part
        const currentUsers = rooms[randomChannelName]?.users || [];
        const leavingCandidates = currentUsers.filter(u => {
          const name = cleanNick(u);
          return name !== cleanNick(nick) && name !== 'Python_Expert' && name !== 'PyQt6_Fan';
        });

        if (leavingCandidates.length === 0) return;
        const targetUser = leavingCandidates[Math.floor(Math.random() * leavingCandidates.length)];

        addMessageToRoom(randomChannelName, 'SYSTEM', `*** ${targetUser} has left ${randomChannelName}`, 'part');
        removeUserFromRoom(randomChannelName, targetUser);
      } else {
        // User Kick
        const currentUsers = rooms[randomChannelName]?.users || [];
        const opsInRoom = currentUsers.filter(u => u.startsWith('@'));
        const kicker = opsInRoom.length > 0 ? cleanNick(opsInRoom[Math.floor(Math.random() * opsInRoom.length)]) : 'Python_Expert';
        
        const kickCandidates = currentUsers.filter(u => {
          const name = cleanNick(u);
          return name !== cleanNick(nick) && name !== kicker && name !== 'Python_Expert';
        });

        if (kickCandidates.length === 0) return;
        const targetUser = kickCandidates[Math.floor(Math.random() * kickCandidates.length)];
        const cleanTarget = cleanNick(targetUser);
        const reason = kickReasons[Math.floor(Math.random() * kickReasons.length)];

        addMessageToRoom(randomChannelName, 'SYSTEM', `*** ${cleanTarget} was kicked by ${kicker} (${reason})`, 'error');
        removeUserFromRoom(randomChannelName, targetUser);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isConnected, rooms, nick]);

  const playMentionSound = () => {
    if (!mentionNotify) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      // Beautiful retro chat alert chime: High pitch sweet dual-tone synth
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(698.46, now + 0.06); // F5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.18); // C6
      gain2.gain.setValueAtTime(0.12, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.35);
    } catch (err) {
      console.warn('Web Audio API notification error:', err);
    }
  };

  const addMessageToRoom = (
    roomName: string,
    sender: string,
    text: string,
    type: IRCMessage['type'] = 'user'
  ) => {
    // Intercept and route status/mode messages only to MOTD or Status tab
    const isStatusOrMode = 
      text.includes('[MODE]') || 
      /\[\d{3}\]/.test(text) || 
      text.includes('Current local users') || 
      text.includes('Current global users');

    let targetRoom = roomName;
    if (isStatusOrMode) {
      targetRoom = rooms['MOTD'] ? 'MOTD' : 'Status';
    }

    const cleanCurrentNick = cleanNick(nick);
    const isMention = type === 'user' && 
                      cleanNick(sender) !== cleanCurrentNick && 
                      text.toLowerCase().includes(cleanCurrentNick.toLowerCase());

    const newMessage: IRCMessage = {
      id: `${targetRoom}-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      sender,
      text,
      type,
      isMention,
    };

    if (isMention && mentionNotify) {
      playMentionSound();
    }

    setRooms((prev) => {
      // Fallback to Status if targetRoom not found
      const actualRoom = prev[targetRoom] ? targetRoom : 'Status';
      const room = prev[actualRoom];
      if (!room) return prev;
      return {
        ...prev,
        [actualRoom]: {
          ...room,
          messages: [...room.messages, newMessage],
          unreadCount: actualRoom !== currentRoom ? room.unreadCount + 1 : 0,
        },
      };
    });
  };

  // Create or retrieve a Private Message (PM) query room
  const getOrCreatePMTab = (partnerNick: string, switchToIt = true) => {
    const cleanPartner = cleanNick(partnerNick);
    const pmRoomName = `💬 ${cleanPartner}`;
    
    setRooms((prev) => {
      if (prev[pmRoomName]) return prev;
      return {
        ...prev,
        [pmRoomName]: {
          name: pmRoomName,
          topic: `ข้อความส่วนตัว (Query/Private Message) คุยกับ ${cleanPartner}`,
          users: [nick, `${cleanPartner}`],
          messages: [
            {
              id: `pm-init-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              sender: 'SYSTEM',
              text: `*** เริ่มต้นคุยส่วนตัวแบบแชทลับกับ ${cleanPartner} เรียบร้อยแล้ว (สามารถพิมพ์ข้อความได้ด้านล่าง)`,
              type: 'info',
            }
          ],
          unreadCount: 0,
        }
      };
    });

    if (switchToIt) {
      setCurrentRoom(pmRoomName);
    }
    return pmRoomName;
  };

  // Trigger a simulated delay response from bot when private messaging
  const triggerSimulatedPMReply = (partner: string, userText: string) => {
    const lowerText = userText.toLowerCase();
    let replyText = '';
    
    if (partner === 'Python_Expert') {
      if (lowerText.includes('pyqt') || lowerText.includes('qt')) {
        replyText = 'ใช่เลยครับ! การเขียนโปรแกรม Chat GUI ด้วย PyQt6 แนะนำใช้ระบบ Signal-Slot ในการส่งผ่านข้อมูล จะลื่นไหลไม่สะดุด';
      } else {
        replyText = 'สวัสดีคุณแชทส่วนตัว มีอะไรคุยกับผมเรื่อง Python หรือ PyQt ได้ตลอดเวลาเลยนะยินดีช่วยเสมอ!';
      }
    } else if (partner === 'PyQt6_Fan') {
      replyText = 'คุยส่วนตัวเหรอเนี่ยเขินจัง ฮ่าๆ ลองดูโค้ด Python ในแท็บ Code Viewer สิ มีโครงสร้างที่เข้าใจง่ายและปรับแก้เล่นได้ทันทีนะ!';
    } else if (partner === 'ClassicChatter') {
      replyText = 'การคุยส่วนตัว (Query) ใน IRC ยุค 90-2000 นี่มันคลาสสิกดีจริงนะ มีความเป็นส่วนตัวมากเลย คุยเรโทรสุดเพลิน!';
    } else {
      const pmQuotes = [
        `ยินดีที่ได้แชทส่วนตัวด้วยนะคุณ ${nick}! ยินดีต้อนรับสู่มุมคุยเล่นแบบ VIP`,
        `ข้อความนี้กระซิบแบบปลอดภัยผ่านระบบ Private Query เลย มีความสุขที่ได้คุยครับ!`,
        `สวัสดีครับ ผมเป็นบอทจำลองแชทอัตโนมัติ ยินดีที่คุยกันนะครับ!`,
        `พิมพ์เก่งจังครับ คุยในเซิร์ฟเวอร์จำลองกับผมแบบนี้เรโทรน่าดูเลยเนอะ`
      ];
      replyText = pmQuotes[Math.floor(Math.random() * pmQuotes.length)];
    }

    const pmRoomName = `💬 ${partner}`;
    setTimeout(() => {
      addMessageToRoom(pmRoomName, partner, replyText, 'user');
    }, 1000 + Math.random() * 1000);
  };

  // Append a user's tag correctly in the chat input
  const handleTagUser = (tagNick: string) => {
    const cleanN = cleanNick(tagNick);
    if (cleanN.toLowerCase() === cleanNick(nick).toLowerCase()) return;
    
    setInputValue((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(`@${cleanN}`)) return prev;
      return trimmed ? `${trimmed} @${cleanN} ` : `@${cleanN} `;
    });
    chatInputRef.current?.focus();
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

    // Generate random 10-char ident 'deskXXXXXX' where XXXXXX are numbers and a-f characters
    const chars = '0123456789abcdef';
    let randPart = '';
    for (let i = 0; i < 6; i++) {
      randPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const sessionIdent = `desk${randPart}`;

    let delay = 300;

    // 1. Initial Connection info
    setTimeout(() => {
      addMessageToRoom(
        'Status', 
        'SYSTEM', 
        `กำลังพยายามเปิด Socket เชื่อมต่อไปยัง ${server} พอร์ต ${port} ${useSSL ? 'ด้วยโปรโตคอลความปลอดภัย SSL/TLS...' : 'ด้วยพอร์ตธรรมดา (Non-SSL)...'}`, 
        'system'
      );
    }, delay);

    // 2. SSL Handshake if enabled
    if (useSSL) {
      delay += 500;
      setTimeout(() => {
        addMessageToRoom('Status', 'SYSTEM', `*** กำลังเริ่มต้นกระบวนการจับมือความปลอดภัย (SSL/TLS Handshake)...`, 'system');
      }, delay);

      delay += 600;
      setTimeout(() => {
        addMessageToRoom('Status', 'SYSTEM', `*** SSL/TLS Handshake สำเร็จ! การเข้ารหัสปลอดภัยสมบูรณ์ (Cipher Suite: TLS_AES_256_GCM_SHA384)`, 'system');
      }, delay);
    }

    // 3. Socket Connected & Send NICK / USER
    delay += 500;
    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `เชื่อมต่อกับเซิร์ฟเวอร์สำเร็จ! ส่งสัญญานระบุตัวตนพื้นฐาน (NICK & USER)`, 'system');
    }, delay);

    delay += 400;
    setTimeout(() => {
      addMessageToRoom('Status', 'SYSTEM', `-> NICK ${nick}`, 'info');
      addMessageToRoom('Status', 'SYSTEM', `-> USER ${sessionIdent} 0 * :PyQt6 pIRCH Client`, 'info');
    }, delay);

    // 4. SASL Authentication & NickServ registration if password is provided
    if (password) {
      delay += 600;
      setTimeout(() => {
        addMessageToRoom('Status', 'SYSTEM', `-> CAP REQ :sasl`, 'info');
        addMessageToRoom('Status', 'SYSTEM', `<- CAP * ACK :sasl`, 'system');
      }, delay);

      delay += 500;
      setTimeout(() => {
        addMessageToRoom('Status', 'SYSTEM', `-> AUTHENTICATE PLAIN`, 'info');
        addMessageToRoom('Status', 'SYSTEM', `<- AUTHENTICATE +`, 'system');
      }, delay);

      delay += 500;
      setTimeout(() => {
        // Simple base64 mock
        const authString = btoa(`\0${nick}\0${password}`);
        addMessageToRoom('Status', 'SYSTEM', `-> AUTHENTICATE ${authString.substring(0, 12)}...`, 'info');
        addMessageToRoom('Status', 'SYSTEM', `<- 903 ${nick} :SASL authentication successful`, 'system');
        addMessageToRoom('Status', 'SYSTEM', `-> CAP END`, 'info');
      }, delay);

      delay += 600;
      setTimeout(() => {
        const lowerNick = nick.trim().toLowerCase();
        const isRegistered = registeredUsers.includes(lowerNick);

        if (isRegistered) {
          addMessageToRoom('Status', 'NickServ', `<- :NickServ!services@thaiirc.com PRIVMSG ${nick} :ล็อกอินเข้าสู่ระบบผ่าน SASL ด้วยชื่อเล่น ${nick} สำเร็จแล้ว (You are now identified for your nickname)`, 'info');
        } else {
          addMessageToRoom('Status', 'NickServ', `<- :NickServ!services@thaiirc.com PRIVMSG ${nick} :ชื่อเล่นของคุณยังไม่ได้ลงทะเบียน ระบบกำลังทำการลงทะเบียนบัญชีใหม่ด้วยอีเมล user@thaiirc.com โดยอัตโนมัติ...`, 'info');
          
          // Add to registered list
          setRegisteredUsers(prev => [...prev, lowerNick]);
          
          setTimeout(() => {
            addMessageToRoom('Status', 'NickServ', `<- :NickServ!services@thaiirc.com PRIVMSG ${nick} :ลงทะเบียนชื่อเล่น ${nick} ด้วยอีเมล user@thaiirc.com และเปิดใช้งานระบบรักษาความปลอดภัย SASL สำเร็จ! รหัสผ่านของท่านได้รับการบันทึกเรียบร้อยแล้ว`, 'info');
          }, 400);
        }
      }, delay);
    }

    // 5. MOTD Retrieval
    delay += 800;
    setTimeout(() => {
      // Create MOTD room tab dynamically
      setRooms((prev) => {
        if (prev['MOTD']) return prev;
        return {
          ...prev,
          MOTD: {
            name: 'MOTD',
            topic: 'Message of the Day (MOTD) from Server',
            users: [],
            messages: [
              {
                id: `motd-header-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                sender: 'SYSTEM',
                text: '=== MESSAGE OF THE DAY ===',
                type: 'info',
              },
            ],
            unreadCount: 0,
          },
        };
      });

      // Send MOTD messages into MOTD room
      addMessageToRoom('MOTD', 'SYSTEM', `ต้อนรับเข้าระบบ (RPL_WELCOME 001): ยินดีต้อนรับเข้าสู่เครือข่าย IRC! (Ident: ${sessionIdent})`, 'motd');
      if (password) {
        addMessageToRoom('MOTD', 'SYSTEM', `[AUTH] - ยืนยันตัวตนสำเร็จผ่านระบบความปลอดภัย SASL PLAIN`, 'motd');
      }
      if (useSSL) {
        addMessageToRoom('MOTD', 'SYSTEM', `[SSL] - เชื่อมต่อแบบเข้ารหัสที่มีความปลอดภัยสูงด้วย SSL/TLS`, 'motd');
      }
      addMessageToRoom('MOTD', 'SYSTEM', `[MOTD] - ยินดีต้อนรับสู่เซิร์ฟเวอร์ IRC จำลองความเสถียรสูง`, 'motd');
      addMessageToRoom('MOTD', 'SYSTEM', `[MOTD] - พัฒนาจำลองขึ้นมาเพื่อให้ทดสอบ UI pIRCH และช่วยทำโค้ด PyQt6 ติดตั้งได้สะดวก`, 'motd');
      addMessageToRoom('MOTD', 'SYSTEM', `[MOTD] - เธรดเครือข่ายถูกแยกไว้ในคลาส IRCWorker เรียบร้อยแล้ว`, 'motd');

      // Notify user in Status room
      addMessageToRoom('Status', 'SYSTEM', `ได้รับ Message of the Day (MOTD) เรียบร้อยแล้ว (เปิดดูได้ที่แท็บ MOTD ด้านบน)`, 'system');
    }, delay);

    // 6. Online established
    delay += 600;
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      addMessageToRoom('Status', 'SYSTEM', `เชื่อมต่อสถานะออนไลน์สมบูรณ์! กำลังเข้าร่วมห้องแชทอัตโนมัติ: ${targetChannel}`, 'system');
      
      // Create and switch to target channel
      joinChannel(targetChannel);
    }, delay);
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
          // Standard initial users with operator @ and voice + prefixes
          users: [nick, '@Python_Expert', '@PyQt6_Fan', '+ClassicChatter', 'MemeLord', 'RetroUser'],
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
      } else if (command === 'QUERY') {
        if (!args) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อผู้ใช้งาน เช่น /query Somchai', 'error');
          return;
        }
        if (!isConnected) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาทำการเชื่อมต่อเซิร์ฟเวอร์ก่อน!', 'error');
          return;
        }
        getOrCreatePMTab(args);
      } else if (command === 'MSG') {
        const cmdParts = args.split(' ');
        const targetNick = cmdParts[0];
        const msgText = cmdParts.slice(1).join(' ');

        if (!targetNick || !msgText) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อผู้ใช้และข้อความ เช่น /msg Somchai สวัสดี', 'error');
          return;
        }
        if (!isConnected) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาทำการเชื่อมต่อเซิร์ฟเวอร์ก่อน!', 'error');
          return;
        }

        const pmRoomName = getOrCreatePMTab(targetNick, true);
        addMessageToRoom(pmRoomName, nick, msgText, 'user');
        triggerSimulatedPMReply(targetNick, msgText);
      } else if (command === 'NICK') {
        if (!args) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อเล่นใหม่ เช่น /nick NewNick', 'error');
          return;
        }
        const oldNick = nick;
        setNick(args);
        
        // Single atomic state update to prevent batching race conditions
        setRooms((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((r) => {
            const roomObj = next[r];
            if (roomObj) {
              const newMessage: IRCMessage = {
                id: `nickchange-${r}-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toLocaleTimeString(),
                sender: 'SYSTEM',
                text: `*** ${oldNick} เปลี่ยนชื่อเป็น ${args}`,
                type: 'system',
              };
              next[r] = {
                ...roomObj,
                users: roomObj.users.map((u) => (cleanNick(u) === cleanNick(oldNick) ? u.replace(cleanNick(oldNick), args) : u)),
                messages: [...roomObj.messages, newMessage],
                unreadCount: r !== currentRoom ? roomObj.unreadCount + 1 : 0,
              };
            }
          });
          return next;
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
      } else if (command === 'KICK') {
        if (currentRoom === 'Status' || currentRoom === 'MOTD') {
          addMessageToRoom(currentRoom, 'SYSTEM', 'ไม่สามารถเตะผู้ใช้ในหน้าต่างสถานะได้', 'error');
          return;
        }
        const cmdParts = args.split(' ');
        const targetNickName = cmdParts[0];
        const reason = cmdParts.slice(1).join(' ') || 'Kicked by operator';
        
        if (!targetNickName) {
          addMessageToRoom(currentRoom, 'SYSTEM', 'กรุณาระบุชื่อเล่นที่ต้องการเตะ เช่น /kick Somchai', 'error');
          return;
        }

        const roomUsers = rooms[currentRoom]?.users || [];
        const foundUser = roomUsers.find(u => cleanNick(u) === cleanNick(targetNickName));

        if (!foundUser) {
          addMessageToRoom(currentRoom, 'SYSTEM', `ไม่พบผู้ใช้งาน ${targetNickName} ในห้องแชทนี้`, 'error');
          return;
        }

        addMessageToRoom(currentRoom, 'SYSTEM', `*** ${cleanNick(foundUser)} ถูกเตะออกจากห้อง ${currentRoom} โดย ${nick} (${reason})`, 'error');
        removeUserFromRoom(currentRoom, foundUser);
      } else if (command === 'QUIT') {
        addMessageToRoom(currentRoom, 'SYSTEM', 'กำลังส่งคำสั่ง QUIT เพื่อออกจากเซิร์ฟเวอร์...', 'system');
        setTimeout(() => {
          setIsConnected(false);
          setIsConnecting(false);
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
                  text: `*** ตัดการเชื่อมต่อจากเซิร์ฟเวอร์ ${server} เรียบร้อยแล้ว (QUIT).`,
                  type: 'system',
                },
              ],
              unreadCount: 0,
            },
          });
          setCurrentRoom('Status');
        }, 600);
      } else if (command === 'HELP') {
        addMessageToRoom(currentRoom, 'SYSTEM', '=== คำสั่ง IRC จำลองที่รองรับในระบบ ===', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/join #ชื่อห้อง - เข้าร่วมห้องแชทใหม่', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/query ชื่อผู้ใช้ - เปิดห้องกระซิบคุยส่วนตัว PM', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/msg ชื่อผู้ใช้ ข้อความ - ส่งข้อความแชทส่วนตัวด่วน', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/nick ชื่อใหม่ - เปลี่ยนชื่อเล่นของคุณ', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/kick ชื่อผู้ใช้ [เหตุผล] - เตะผู้ใช้งานออกจากห้องแชท', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/leave หรือ /part - ออกจากห้องแชทปัจจุบัน', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/quit - ตัดการเชื่อมต่อจากเซิร์ฟเวอร์', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/help - เปิดคู่มือคำสั่งช่วยเหลือนี้', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '/me ข้อความการกระทำ - ส่งข้อความสถานะการกระทำ', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '=== วิธีจัดรูปแบบอักษรและข้อความสีแบบ mIRC ===', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '^Bตัวหนา^B (หรือใช้ &B) | ^Uขีดเส้นใต้^U (หรือใช้ &U)', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '^Cตัวเลขสีอักษร - เช่น ^C4สีแดง ^C12สีฟ้า ^C3สีเขียว ^C9เขียวอ่อน', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '^Cสีอักษร,สีพื้นหลัง - เช่น ^C0,1อักษรขาวพื้นหลังดำ (รหัสสี 0-15)', 'info');
        addMessageToRoom(currentRoom, 'SYSTEM', '^O (หรือใช้ &O) - เพื่อรีเซ็ตค่ารูปแบบกลับเป็นตัวอักษรธรรมดา', 'info');
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

    if (currentRoom.startsWith('💬 ')) {
      const partner = currentRoom.replace('💬 ', '');
      triggerSimulatedPMReply(partner, text);
    } else {
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
    }
  };

  const getMessageColorClass = (type: IRCMessage['type']) => {
    if (isDarkMode) {
      switch (type) {
        case 'system':
          return 'text-[#14b8a6] font-bold'; // Teal system (Teal-500)
        case 'error':
          return 'text-[#ef4444] font-bold'; // Red error (Red-500)
        case 'motd':
          return 'text-[#d946ef]'; // Fuchsia MOTD (Fuchsia-500)
        case 'join':
          return 'text-[#22c55e] font-semibold'; // Green joins (Green-500)
        case 'part':
          return 'text-[#eab308]'; // Yellow parts (Yellow-500)
        case 'info':
          return 'text-[#60a5fa] font-sans italic'; // Blue system outputs (Blue-400)
        default:
          return 'text-slate-200'; // Light user messages
      }
    } else {
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
    }
  };

  const activeRoomData = rooms[currentRoom] || { messages: [], users: [] };

  return (
    <div className={`flex flex-col h-full win95-font transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* 1. Top Input Panel (pIRCH layout - modern premium form style) */}
      <div className={`p-2.5 flex flex-wrap gap-3 items-center mb-0.5 rounded-t-lg shadow-sm border-b transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-200/80 text-slate-700'
      }`}>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold whitespace-nowrap text-xs transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Server:</span>
          <input
            type="text"
            value={server}
            onChange={(e) => !isConnected && !isConnecting && setServer(e.target.value)}
            disabled={isConnected || isConnecting}
            className={`px-2.5 py-1 w-[140px] text-xs outline-none font-mono rounded-md transition-all shadow-sm focus:ring-1 ${
              isDarkMode
                ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
                : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`font-semibold whitespace-nowrap text-xs transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Port:</span>
          <input
            type="text"
            value={port}
            onChange={(e) => !isConnected && !isConnecting && setPort(e.target.value)}
            disabled={isConnected || isConnecting}
            className={`py-1 w-[45px] text-xs text-center outline-none font-mono rounded-md transition-all shadow-sm focus:ring-1 ${
              isDarkMode
                ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
                : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`font-semibold whitespace-nowrap text-xs transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Nick:</span>
          <input
            type="text"
            value={nick}
            onChange={(e) => !isConnecting && setNick(e.target.value)}
            disabled={isConnecting}
            className={`px-2.5 py-1 w-[110px] text-xs outline-none font-mono rounded-md transition-all shadow-sm focus:ring-1 ${
              isDarkMode
                ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
                : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'
            }`}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Font size adjustment button */}
          <button
            type="button"
            onClick={() => setFontSize((prev) => (prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'))}
            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-sm ${
              isDarkMode
                ? 'bg-slate-800 text-indigo-300 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-indigo-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="ปรับขนาดตัวอักษร (3 ระดับ)"
            id="btn-irc-font-toggle"
          >
            <span>Aa</span>
            <span className="text-[9px] px-1 bg-slate-200/50 dark:bg-slate-700/80 rounded uppercase">
              {fontSize === 'sm' ? 'เล็ก' : fontSize === 'md' ? 'กลาง' : 'ใหญ่'}
            </span>
          </button>

          {/* Dark/Light mode theme switch */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center justify-center p-1.5 rounded-lg border transition-all duration-150 active:scale-95 cursor-pointer shadow-sm ${
              isDarkMode
                ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-indigo-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="btn-irc-theme-toggle"
          >
            {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Mention Tag Notification Toggle Button */}
          <button
            type="button"
            onClick={() => setMentionNotify(!mentionNotify)}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-sm ${
              mentionNotify
                ? isDarkMode
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/60 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : isDarkMode
                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            title={mentionNotify ? "ปิดระบบแจ้งเตือนการแทกชื่อ" : "เปิดระบบแจ้งเตือนการแทกชื่อ"}
            id="btn-irc-mention-toggle"
          >
            {mentionNotify ? <Bell size={13} className="text-emerald-500 animate-swing" /> : <BellOff size={13} />}
            <span>แทกชื่อ</span>
            <span className={`text-[9px] px-1 rounded uppercase font-bold ${
              mentionNotify 
                ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400' 
                : 'bg-slate-200/50 dark:bg-slate-700/80 text-slate-500'
            }`}>
              {mentionNotify ? 'เปิด' : 'ปิด'}
            </span>
          </button>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`flex items-center justify-center gap-1.5 px-4.5 py-1.5 text-xs font-bold min-w-[100px] rounded-lg border transition-all duration-150 active:scale-95 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed ${
              isConnecting
                ? 'bg-slate-100 text-slate-400 border-slate-200'
                : isConnected
                ? isDarkMode
                  ? 'bg-red-950/40 hover:bg-red-950/60 text-red-400 border-red-900/50 shadow-sm'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-sm'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm hover:shadow-indigo-500/10'
            }`}
            id="btn-irc-connect-sim"
          >
            {isConnecting ? (
              <span className="animate-pulse">Connecting...</span>
            ) : isConnected ? (
              <>
                <Square size={11} className="fill-current text-red-500" />
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
      </div>

      {/* 1.5 Online Radio Bar - Modern Futuristic Design */}
      <div className={`py-2 px-4 flex flex-wrap items-center gap-3.5 border-b transition-all ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800 text-slate-200 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]' 
          : 'bg-white border-slate-200 text-slate-700'
      }`}>
        {/* Style block for visualizer animation keyframes */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes eq-bar {
            0% { height: 4px; }
            50% { height: 20px; }
            100% { height: 6px; }
          }
          .animate-eq-1 { animation: eq-bar 0.7s ease-in-out infinite alternate; }
          .animate-eq-2 { animation: eq-bar 1.1s ease-in-out infinite alternate 0.15s; }
          .animate-eq-3 { animation: eq-bar 0.5s ease-in-out infinite alternate 0.3s; }
          .animate-eq-4 { animation: eq-bar 0.9s ease-in-out infinite alternate 0.05s; }
          .animate-eq-5 { animation: eq-bar 0.6s ease-in-out infinite alternate 0.2s; }
          .animate-eq-6 { animation: eq-bar 1.0s ease-in-out infinite alternate 0.4s; }
        `}} />

        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio size={15} className={`text-indigo-500 shrink-0 ${radioPlaying ? 'animate-bounce' : ''}`} />
            {radioPlaying && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </div>
          <span className={`text-[11px] font-bold tracking-wider uppercase font-sans ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
            Radio Online
          </span>
          {radioPlaying && (
            <span className="text-[9px] bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
              LIVE
            </span>
          )}
        </div>

        {/* Station Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleRadio('mquest')}
            className={`px-3 py-1 text-xs font-bold rounded-md border transition-all duration-150 cursor-pointer active:scale-95 ${
              currentStation === 'mquest' && radioPlaying
                ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : isDarkMode
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title="MQuest Radio Stream"
          >
            MQuest Radio
          </button>

          <button
            onClick={() => toggleRadio('live')}
            className={`px-3 py-1 text-xs font-bold rounded-md border transition-all duration-150 cursor-pointer active:scale-95 ${
              currentStation === 'live' && radioPlaying
                ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : isDarkMode
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title="Live Radio Stream"
          >
            Live Radio
          </button>

          {radioPlaying && (
            <button
              onClick={stopRadio}
              className={`p-1 text-xs font-bold rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer`}
              title="Stop playback"
            >
              <Square size={12} className="fill-current" />
            </button>
          )}
        </div>

        {/* Music spectrum visualizer */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 border-l border-slate-700/10 dark:border-slate-800/60">
          <div className="flex items-end gap-[3px] h-5">
            {radioPlaying ? (
              <>
                <div className="w-[3px] bg-cyan-400 rounded-t animate-eq-1" />
                <div className="w-[3px] bg-indigo-400 rounded-t animate-eq-2" />
                <div className="w-[3px] bg-purple-400 rounded-t animate-eq-3" />
                <div className="w-[3px] bg-pink-400 rounded-t animate-eq-4" />
                <div className="w-[3px] bg-rose-400 rounded-t animate-eq-5" />
                <div className="w-[3px] bg-emerald-400 rounded-t animate-eq-6" />
              </>
            ) : (
              <>
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1.5" />
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1" />
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1" />
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1" />
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1" />
                <div className="w-[3px] bg-slate-300 dark:bg-slate-700 rounded-t h-1.5" />
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono select-none">
            {radioPlaying 
              ? currentStation === 'mquest' 
                ? 'playing mquest...' 
                : 'playing live...' 
              : 'radio offline'}
          </span>
        </div>

        {/* Settings fields beautifully integrated on the Radio Bar */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-700/10 dark:border-slate-800/60 flex-wrap">
          <div className="flex items-center gap-1">
            <span className={`font-semibold whitespace-nowrap text-[10px] uppercase tracking-wider transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Join:</span>
            <input
              type="text"
              value={targetChannel}
              onChange={(e) => !isConnected && !isConnecting && setTargetChannel(e.target.value)}
              disabled={isConnected || isConnecting}
              placeholder="#channel"
              className={`px-2 py-0.5 w-[75px] text-[11px] outline-none font-mono rounded transition-all shadow-sm focus:ring-1 ${
                isDarkMode
                  ? 'bg-slate-950 border border-slate-800 text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
                  : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className={`font-semibold whitespace-nowrap text-[10px] uppercase tracking-wider transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pass:</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConnected || isConnecting}
              placeholder="SASL"
              className={`px-2 py-0.5 w-[65px] text-[11px] outline-none font-mono rounded transition-all shadow-sm focus:ring-1 ${
                isDarkMode
                  ? 'bg-slate-950 border border-slate-800 text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
                  : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center select-none">
            <label className="flex items-center gap-1 cursor-pointer text-[10px] uppercase tracking-wider font-semibold">
              <input
                type="checkbox"
                checked={useSSL}
                disabled={isConnected || isConnecting}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseSSL(checked);
                  if (checked && port === '6667') {
                    setPort('6697');
                  } else if (!checked && port === '6697') {
                    setPort('6667');
                  }
                }}
                className="accent-indigo-600 cursor-pointer w-3 h-3"
              />
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>SSL</span>
            </label>
          </div>
        </div>

        {/* Volume controls */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setRadioVolume((prev) => (prev === 0 ? 0.5 : 0))}
            className={`text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer`}
            title={radioVolume === 0 ? "Unmute" : "Mute"}
          >
            {radioVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={radioVolume}
            onChange={(e) => setRadioVolume(parseFloat(e.target.value))}
            className="w-16 h-1 rounded bg-slate-200 dark:bg-slate-700 accent-indigo-500 cursor-pointer outline-none"
            title={`Volume: ${Math.round(radioVolume * 100)}%`}
          />
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 min-w-[24px] text-right">
            {Math.round(radioVolume * 100)}%
          </span>
        </div>
      </div>

      {/* 2. Channel Rooms Selector Tabs (Segmented bar style) */}
      <div className={`flex p-1.5 gap-1 overflow-x-auto select-none border-b transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        {Object.keys(rooms).map((roomName) => {
          const roomObj = rooms[roomName];
          const isSelected = roomName === currentRoom;
          return (
            <div
              key={roomName}
              onClick={() => {
                setCurrentRoom(roomName);
                // Reset unread count
                setRooms((prev) => ({
                  ...prev,
                  [roomName]: { ...prev[roomName], unreadCount: 0 },
                }));
              }}
              className={`flex items-center gap-1.5 px-3 py-1 font-sans text-xs font-semibold rounded-md transition-all relative cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm font-bold animate-fade-in'
                  : isDarkMode
                  ? 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  : 'bg-transparent text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              id={`tab-channel-${roomName.replace('#', '').replace('💬 ', 'pm_')}`}
            >
              <span className="select-none flex items-center gap-1">
                {roomName}
                {roomName.startsWith('#') && roomObj.users && roomObj.users.length > 0 && ` (${roomObj.users.length})`}
              </span>
              {roomObj.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[8px] font-bold px-1.5 py-0.5 animate-bounce shadow">
                  {roomObj.unreadCount}
                </span>
              )}
              {roomName !== 'Status' && roomName !== 'MOTD' && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Close/remove room
                    setCurrentRoom('Status');
                    setRooms((prev) => {
                      const copy = { ...prev };
                      delete copy[roomName];
                      return copy;
                    });
                  }}
                  className={`ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-4 h-4 flex items-center justify-center text-[11px] leading-none text-slate-400 hover:text-rose-500 transition-colors`}
                  title="Close tab"
                >
                  ×
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Room Topic bar */}
      <div className={`py-1.5 px-3 flex items-center gap-2 text-xs border-b transition-colors ${
        isDarkMode ? 'bg-slate-950 border-slate-900 text-slate-400' : 'bg-slate-50 border-slate-200/60 text-slate-500'
      }`}>
        <Info size={13} className="text-indigo-500 shrink-0" />
        <span className="font-medium truncate">
          Topic: <span className={`font-normal transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{activeRoomData.topic || 'No topic is set for this window'}</span>
        </span>
      </div>

      {/* 4. Chat Workspace & Nick List Panel (Split View) */}
      <div className={`flex-1 min-h-0 flex gap-3 p-3 transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {/* Chat window with dynamic font sizing */}
        <div 
          style={{ fontSize: fontSize === 'sm' ? '11px' : fontSize === 'lg' ? '16px' : '13px' }}
          className={`min-h-0 border rounded-xl p-3 overflow-y-auto flex flex-col gap-1 shadow-inner select-text transition-all ${
            currentRoom.startsWith('#') ? 'w-[80%]' : 'w-full'
          } ${
            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          {activeRoomData.messages.map((msg) => {
            const isUserMsg = msg.type === 'user';
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 items-start py-1 rounded px-2 transition-all ${
                  msg.isMention && mentionNotify
                    ? isDarkMode 
                      ? 'bg-amber-500/10 border-l-2 border-amber-500 shadow-[inset_1px_0_0_rgba(245,158,11,0.05)] text-amber-200' 
                      : 'bg-amber-500/5 border-l-2 border-amber-500 shadow-[inset_1px_0_0_rgba(245,158,11,0.1)] text-amber-900'
                    : 'hover:bg-slate-500/5 dark:hover:bg-slate-400/5'
                }`}
              >
                {/* 1. Time Column */}
                <span className={`select-none font-sans font-medium text-right w-11 shrink-0 select-none text-[10px] self-center transition-colors ${
                  isDarkMode ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {msg.timestamp.substring(0, 5) || msg.timestamp}
                </span>

                {/* 2. Vertical Column Divider */}
                <div className={`w-[1px] h-3.5 self-center shrink-0 transition-colors ${
                  isDarkMode ? 'bg-slate-800' : 'bg-slate-200/80'
                }`} />

                {/* 3. Sender / Icon Column */}
                <div className="w-24 shrink-0 text-right pr-1 select-none font-bold truncate">
                  {isUserMsg ? (
                    <span 
                      onClick={() => {
                        const isMe = cleanNick(msg.sender) === cleanNick(nick);
                        if (!isMe) handleTagUser(msg.sender);
                      }}
                      className={`cursor-pointer transition-colors ${
                        msg.isMention && mentionNotify
                          ? 'text-amber-500 font-extrabold hover:text-amber-400'
                          : isDarkMode 
                          ? 'text-indigo-400 hover:text-indigo-300' 
                          : 'text-indigo-600 hover:text-indigo-700'
                      }`}
                      title={cleanNick(msg.sender) !== cleanNick(nick) ? `คลิกเพื่อแทกชื่อ @${cleanNick(msg.sender)}` : undefined}
                    >
                      {msg.sender}
                    </span>
                  ) : (
                    <span className={`text-center font-sans font-bold text-xs ${
                      msg.type === 'join' ? 'text-emerald-500' : 
                      msg.type === 'part' ? 'text-amber-500' : 
                      msg.type === 'error' ? 'text-rose-500' : 'text-slate-400'
                    }`}>
                      {msg.type === 'join' ? '➔' : msg.type === 'part' ? '🚪' : msg.type === 'error' ? '❌' : '•'}
                    </span>
                  )}
                </div>

                {/* 4. Text Content Column with Indentation Alignment */}
                <div className="flex-1 text-left break-words">
                  {isUserMsg ? (
                    <div className="flex flex-col gap-1.5">
                      <span className={`whitespace-pre-wrap transition-colors ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {renderFormattedText(msg.text, isDarkMode)}
                      </span>
                      {msg.fileUrl && (
                        <div className={`mt-1 p-2 rounded-lg border max-w-sm ${isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          {msg.isImage ? (
                            <div className="flex flex-col gap-1">
                              <img src={msg.fileUrl} alt={msg.fileName} className="max-h-40 object-contain rounded border border-slate-700/10 dark:border-slate-800" referrerPolicy="no-referrer" />
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate block">{msg.fileName} ({msg.fileSize})</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xl">📄</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold block truncate text-indigo-500">{msg.fileName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{msg.fileSize}</span>
                              </div>
                              <a href={msg.fileUrl} download={msg.fileName} className="px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-all cursor-pointer">
                                Download
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={`font-sans italic ${getMessageColorClass(msg.type)}`}>
                      {renderFormattedText(msg.text, isDarkMode)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* User list pane */}
        {currentRoom.startsWith('#') && (
          <div 
            style={{ fontSize: fontSize === 'sm' ? '10px' : fontSize === 'lg' ? '14px' : '11px' }}
            className={`w-[20%] border rounded-xl p-3 overflow-y-auto flex flex-col select-none shadow-inner transition-colors ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/80'
            }`}
          >
            <div className={`flex items-center gap-1.5 border-b pb-2 mb-2 px-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isDarkMode ? 'border-slate-900 text-slate-500' : 'border-slate-100 text-slate-400'
            }`}>
              <Users size={11} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
              <span>Users ({activeRoomData.users.length})</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {[...activeRoomData.users]
                .sort((a, b) => {
                  const cleanA = cleanNick(a);
                  const cleanB = cleanNick(b);
                  
                  const getRoleWeight = (user: string): number => {
                    if (user.startsWith('~')) return 0;
                    if (user.startsWith('&')) return 1;
                    if (user.startsWith('@') || user === 'Python_Expert' || user === 'PyQt6_Fan') return 2;
                    if (user.startsWith('%')) return 3;
                    if (user.startsWith('+') || user === 'ClassicChatter') return 4;
                    return 5;
                  };

                  const roleA = getRoleWeight(a);
                  const roleB = getRoleWeight(b);
                  
                  if (roleA !== roleB) {
                    return roleA - roleB;
                  }
                  return cleanA.localeCompare(cleanB);
                })
                .map((username) => {
                  const displayNick = cleanNick(username);
                  const isMe = displayNick === cleanNick(nick);
                  const isOp = username.startsWith('@') || username.startsWith('&') || username.startsWith('~') || username === 'Python_Expert' || username === 'PyQt6_Fan';
                  const isVoice = username.startsWith('+') || username.startsWith('%') || username === 'ClassicChatter';
                  const hasPrefix = /^[@+%&~]/.test(username);
                  const prefixChar = hasPrefix ? username[0] : '';
                  
                  return (
                    <div
                       key={username}
                       className={`px-2 py-1 rounded-md flex items-center justify-between font-sans transition-all group hover:bg-slate-500/5 cursor-pointer`}
                       title={isMe ? undefined : "ดับเบิ้ลคลิกเพื่อคุยส่วนตัว หรือกดปุ่มด้านขวา"}
                       onDoubleClick={() => !isMe && getOrCreatePMTab(displayNick)}
                    >
                      <span 
                        onClick={() => !isMe && handleTagUser(displayNick)}
                        className={`truncate flex-1 select-none font-medium ${
                          isMe
                            ? isDarkMode
                              ? 'text-indigo-300 font-bold'
                              : 'text-indigo-700 font-bold'
                            : isDarkMode
                            ? 'text-slate-300 hover:text-indigo-400'
                            : 'text-slate-700 hover:text-indigo-600'
                        }`}
                      >
                        {hasPrefix ? `${prefixChar}${displayNick}` : (isOp ? `@${displayNick}` : isVoice ? `+${displayNick}` : displayNick)}
                      </span>
                      
                      {!isMe && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTagUser(displayNick);
                            }}
                            className={`p-1 rounded hover:bg-indigo-600 hover:text-white transition-colors ${
                              isDarkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                            }`}
                            title={`แทกชื่อ @${displayNick}`}
                          >
                            <AtSign size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              getOrCreatePMTab(displayNick);
                            }}
                            className={`p-1 rounded hover:bg-indigo-600 hover:text-white transition-colors ${
                              isDarkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                            }`}
                            title={`คุยส่วนตัว PM กับ ${displayNick}`}
                          >
                            <MessageSquare size={10} />
                          </button>
                        </div>
                      )}

                      {isOp ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded scale-90 shadow-sm shrink-0 group-hover:hidden ${
                          isDarkMode
                            ? 'text-rose-400 bg-rose-950/30 border border-rose-900/50'
                            : 'text-rose-600 bg-rose-50 border border-rose-100'
                        }`}>
                          OP
                        </span>
                      ) : isVoice ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded scale-90 shadow-sm shrink-0 group-hover:hidden ${
                          isDarkMode
                            ? 'text-amber-400 bg-amber-950/30 border border-amber-900/50'
                            : 'text-amber-600 bg-amber-50 border border-amber-100'
                        }`}>
                          VOICE
                        </span>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Message input bar */}
      <form onSubmit={handleSendMessage} className={`border-t p-2.5 flex gap-2 transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />
        <button
          type="button"
          onClick={handleFileAttachClick}
          disabled={!isConnected && currentRoom === 'Status'}
          className={`flex items-center justify-center p-2 rounded-lg border transition-all duration-150 active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer shadow-sm ${
            isDarkMode
              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400'
          }`}
          title="ส่งไฟล์หรือรูปภาพ (Attach File/Image)"
          id="btn-irc-attach"
        >
          <Paperclip size={14} />
        </button>
        <input
          ref={chatInputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            currentRoom === 'Status'
              ? 'ไม่สามารถส่งข้อความที่นี่ได้ (กรุณาดับเบิ้ลคลิกเพื่อสลับไปหน้าห้องแชทจำลอง)'
              : 'พิมพ์ข้อความคุยกับบอท หรือรันคำสั่ง เช่น /join #pyqt6, /nick Somchai จากนั้นกด Enter...'
          }
          disabled={!isConnected && currentRoom !== 'Status'}
          className={`flex-1 px-3.5 py-2 rounded-lg text-xs outline-none transition-all shadow-sm focus:ring-1 ${
            isDarkMode
              ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 disabled:bg-slate-900 disabled:text-slate-600'
              : 'bg-white border border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500 px-3.5 py-2 rounded-lg text-xs outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all shadow-sm'
          }`}
          id="irc-message-input"
        />
        <button
          type="submit"
          disabled={(!isConnected && currentRoom !== 'Status') || !inputValue.trim()}
          className={`disabled:cursor-not-allowed flex items-center justify-center gap-1.5 px-5 font-bold text-xs rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer ${
            isDarkMode
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-800 disabled:text-slate-600'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400'
          }`}
          id="btn-irc-send"
        >
          <Send size={12} />
          <span>Send</span>
        </button>
      </form>

      {/* 6. Client Status Bar */}
      <div className={`border-t py-2 px-3 flex justify-between text-[11px] select-none transition-colors ${
        isDarkMode ? 'bg-slate-950 border-slate-900 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        <div className="flex gap-4">
          <span className="font-bold">
            Status:{' '}
            <span className={isConnected ? 'text-emerald-500 font-bold' : isConnecting ? 'text-amber-500 animate-pulse font-bold' : 'text-slate-400 font-medium'}>
              {isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING...' : 'OFFLINE'}
            </span>
          </span>
          {isConnected && (
            <div className="hidden md:flex gap-4">
              <span>
                Server: <strong className={`font-mono font-medium transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{server}</strong>
              </span>
              <span>
                Room: <strong className={`font-mono font-medium transition-colors ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{currentRoom}</strong>
              </span>
              <span>
                Nick: <strong className={`font-mono font-medium transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{nick}</strong>
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
