import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Terminal,
  MessageSquare,
  HelpCircle,
  Volume2,
  FolderOpen,
  Power,
  ChevronRight,
  Cpu,
  Clock,
  Code2
} from 'lucide-react';
import { DesktopWindow } from './types';
import RetroWindow from './components/RetroWindow';
import IRCClientSim from './components/IRCClientSim';
import PythonCodeViewer from './components/PythonCodeViewer';

export default function App() {
  const [windows, setWindows] = useState<DesktopWindow[]>([
    {
      id: 'pirch',
      title: 'pyIRCH98 - Classic Chat Simulator',
      type: 'pirch',
      x: 30,
      y: 50,
      w: 680,
      h: 460,
      isMinimized: false,
      isMaximized: false,
      isOpen: true,
      zIndex: 10,
    },
    {
      id: 'python_code',
      title: 'Python PyQt6 Desktop Code Viewer & Compiler',
      type: 'python_code',
      x: 100,
      y: 90,
      w: 720,
      h: 510,
      isMinimized: false,
      isMaximized: false,
      isOpen: false,
      zIndex: 5,
    },
    {
      id: 'about_pirch',
      title: 'About pyIRCH98 & PyQt6',
      type: 'about_pirch',
      x: 150,
      y: 140,
      w: 480,
      h: 340,
      isMinimized: false,
      isMaximized: false,
      isOpen: true, // Let's open it by default as a nice greeting!
      zIndex: 12,
    },
  ]);

  const [activeWindowId, setActiveWindowId] = useState<string>('about_pirch');
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showShutdown, setShowShutdown] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close start menu when clicking on desktop
  const handleDesktopClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#start-menu-button') && !target.closest('#start-menu-panel')) {
      setStartMenuOpen(false);
    }
  };

  // Helper to bring window to front
  const focusWindow = (id: string) => {
    setWindows((prev) => {
      const maxZ = Math.max(...prev.map((w) => w.zIndex), 0);
      return prev.map((w) => {
        if (w.id === id) {
          return { ...w, isMinimized: false, zIndex: maxZ + 1 };
        }
        return w;
      });
    });
    setActiveWindowId(id);
  };

  const handleWindowClose = (id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: false } : w)));
    if (activeWindowId === id) {
      // Find another open window to focus
      const remaining = windows.filter((w) => w.id !== id && w.isOpen && !w.isMinimized);
      if (remaining.length > 0) {
        // Sort by zIndex descending
        remaining.sort((a, b) => b.zIndex - a.zIndex);
        setActiveWindowId(remaining[0].id);
      } else {
        setActiveWindowId('');
      }
    }
  };

  const handleWindowMinimize = (id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)));
    if (activeWindowId === id) {
      setActiveWindowId('');
    }
  };

  const handleWindowMaximize = (id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)));
  };

  const handleLaunchWindow = (id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: true, isMinimized: false } : w)));
    focusWindow(id);
    setStartMenuOpen(false);
  };

  // Handle taskbar button click (toggle minimize/focus)
  const handleTaskbarClick = (id: string) => {
    const win = windows.find((w) => w.id === id);
    if (!win) return;

    if (win.isMinimized) {
      handleLaunchWindow(id);
    } else if (activeWindowId === id) {
      handleWindowMinimize(id);
    } else {
      focusWindow(id);
    }
  };

  return (
    <div
      onClick={handleDesktopClick}
      className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden relative flex flex-col font-sans select-none text-slate-100"
      id="retro-desktop-root"
    >
      {/* 1. Desktop Wallpaper / Grid Area */}
      <div className="flex-1 relative p-6 flex flex-col items-start gap-6" id="desktop-grid">
        {/* Desktop Icon: pIRCH98 */}
        <div
          onDoubleClick={() => handleLaunchWindow('pirch')}
          onClick={() => handleLaunchWindow('pirch')}
          className="flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer w-24 text-center hover:bg-white/10 active:bg-white/15 group transition-all duration-150"
          id="icon-pirch"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#0054e3] to-[#27c4fb] rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-indigo-500/35 transition-all text-white duration-200">
            <MessageSquare size={26} className="stroke-[2]" />
          </div>
          <span className="text-white text-xs font-semibold mt-2.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] leading-tight select-none tracking-wide">
            pIRCH98 Client
          </span>
        </div>

        {/* Desktop Icon: Python Code */}
        <div
          onDoubleClick={() => handleLaunchWindow('python_code')}
          onClick={() => handleLaunchWindow('python_code')}
          className="flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer w-24 text-center hover:bg-white/10 active:bg-white/15 group transition-all duration-150"
          id="icon-python-code"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-purple-500/35 transition-all text-white duration-200">
            <Terminal size={26} className="stroke-[2]" />
          </div>
          <span className="text-white text-xs font-semibold mt-2.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] leading-tight select-none tracking-wide">
            Python PyQt6
          </span>
        </div>

        {/* Desktop Icon: About */}
        <div
          onDoubleClick={() => handleLaunchWindow('about_pirch')}
          onClick={() => handleLaunchWindow('about_pirch')}
          className="flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer w-24 text-center hover:bg-white/10 active:bg-white/15 group transition-all duration-150"
          id="icon-about"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-rose-500/35 transition-all text-white duration-200">
            <HelpCircle size={26} className="stroke-[2]" />
          </div>
          <span className="text-white text-xs font-semibold mt-2.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] leading-tight select-none tracking-wide">
            About Client
          </span>
        </div>

        {/* Help tips overlay on the bottom right */}
        <div className="absolute bottom-5 right-5 max-w-[290px] bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl p-4 text-xs leading-relaxed hidden sm:block pointer-events-none rounded-xl">
          <h4 className="font-semibold border-b border-white/10 pb-1.5 mb-2 text-indigo-400 flex items-center gap-1.5">
            <Cpu size={14} className="text-indigo-400 animate-pulse" />
            <span className="tracking-wide">คำแนะนำการใช้งาน</span>
          </h4>
          <p className="text-[11.5px] text-slate-300 space-y-1">
            1. คลิกไอคอนหน้าจอเพื่อเปิดโปรแกรมต่าง ๆ<br />
            2. แชทจำลอง <strong className="text-indigo-300">pIRCH98</strong> เพื่อรันคำสั่งและทดสอบระบบเธรดเบื้องหลังได้ทันที!<br />
            3. เข้าแท็บ <strong className="text-indigo-300">Python PyQt6</strong> เพื่อดาวน์โหลดและนำโค้ดไปรันและคอมไพล์ .EXE ใช้งานจริงในคอมพิวเตอร์ของคุณ
          </p>
        </div>
      </div>

      {/* 2. Window Manager Container (Renders active open windows) */}
      <div className="absolute inset-0 top-10 pointer-events-none" id="window-workspace">
        {windows.map((win) => {
          const isActive = win.id === activeWindowId;
          return (
            <div key={win.id} className="pointer-events-auto h-fit w-fit">
              <RetroWindow
                id={win.id}
                title={win.title}
                isOpen={win.isOpen}
                isMinimized={win.isMinimized}
                isMaximized={win.isMaximized}
                zIndex={win.zIndex}
                isActive={isActive}
                onClose={() => handleWindowClose(win.id)}
                onMinimize={() => handleWindowMinimize(win.id)}
                onMaximize={() => handleWindowMaximize(win.id)}
                onFocus={() => focusWindow(win.id)}
                defaultX={win.id === 'pirch' ? 30 : win.id === 'python_code' ? 90 : 160}
                defaultY={win.id === 'pirch' ? 50 : win.id === 'python_code' ? 90 : 150}
                defaultW={win.id === 'pirch' ? 700 : win.id === 'python_code' ? 760 : 480}
                defaultH={win.id === 'pirch' ? 470 : win.id === 'python_code' ? 520 : 360}
                icon={
                  win.type === 'pirch' ? (
                    <MessageSquare size={12} className="stroke-[2.5]" />
                  ) : win.type === 'python_code' ? (
                    <Terminal size={12} className="stroke-[2.5]" />
                  ) : (
                    <HelpCircle size={12} className="stroke-[2.5]" />
                  )
                }
              >
                {win.type === 'pirch' && <IRCClientSim />}
                {win.type === 'python_code' && <PythonCodeViewer />}
                {win.type === 'about_pirch' && (
                  <div className="flex flex-col h-full bg-slate-50 p-4 text-xs leading-relaxed select-text overflow-y-auto">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-tr from-[#0054e3] to-[#27c4fb] text-white flex items-center justify-center rounded-xl shadow-md p-1">
                        <MessageSquare size={28} />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-800">pyIRCH98 & Python PyQt6 Codebase</h2>
                        <p className="text-[10px] text-slate-500 font-medium">เวอร์ชัน 1.0.0 (สไตล์โมเดิร์นคลาสสิก)</p>
                      </div>
                    </div>

                    <p className="mb-2 text-slate-600">
                      ยินดีต้อนรับผู้ใช้! แอปพลิเคชันเว็บนี้ได้รับการพัฒนาขึ้นมาเพื่อส่งมอบ{' '}
                      <strong className="text-slate-800">โค้ดแอปพลิเคชัน Desktop ภาษา Python ด้วยเฟรมเวิร์ก PyQt6</strong> สำหรับทำหน้าที่เป็น IRC Chat Client ตามที่คุณร้องขอ
                    </p>

                    <h3 className="font-bold text-indigo-600 mt-2 mb-1">⭐ คุณสมบัติเด่นของโครงสร้างโค้ด:</h3>
                    <ul className="list-disc pl-5 mb-3 space-y-1.5 text-slate-600">
                      <li>
                        <strong className="text-slate-700">ระบบแยกเธรด (Threading)</strong>: ใช้ <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono">QThread</code> และ <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono">QObject</code> (IRCWorker) ในการทำงานดึงข้อมูล TCP Socket เบื้องหลัง เพื่อป้องกันไม่ให้โปรแกรมหลักค้างหรือขึ้น Not Responding
                      </li>
                      <li>
                        <strong className="text-slate-700">หน้าต่างดีไซน์พรีเมียม (pIRCH-style)</strong>: ตกแต่งอย่างพิถีพิถัน สบายตา พร้อมฟอนต์เทคโนโลยีและสากลที่มีชื่อเสียง
                      </li>
                      <li>
                        <strong className="text-slate-700">สถาปัตยกรรมขยายต่อได้ง่าย</strong>: รองรับการเข้าห้องหลายๆ ห้องแชท, ระบบ auto-reconnect, และการใช้ Slash Commands (เช่น /join, /nick, /me)
                      </li>
                    </ul>

                    <h3 className="font-bold text-indigo-600 mt-2 mb-1">🎮 วิธีเริ่มต้นใช้งานหน้าเว็บนี้:</h3>
                    <p className="mb-3 text-slate-600">
                      คุณสามารถคลิกเปิดหน้าต่าง <strong className="text-slate-800">"pIRCH98 Client"</strong> บนเดสก์ท็อปเพื่อทดสอบเชื่อมต่อจำลองการแชทกับเหล่าบอท AI ได้ทันที หรือคลิกไปที่หน้าต่าง <strong className="text-slate-800">"Python PyQt6"</strong> เพื่อคัดลอกโค้ดหรือดาวน์โหลดไฟล์ <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono">irc_client.py</code> นำไปคอมไพล์ใช้งานจริงในเครื่องคอมพิวเตอร์ของคุณ!
                    </p>

                    <div className="flex gap-2 justify-end mt-auto pt-3 border-t border-slate-200">
                      <button
                        onClick={() => handleLaunchWindow('pirch')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-1.5 text-xs shadow-sm cursor-pointer transition-all active:scale-95"
                        id="btn-about-open-chat"
                      >
                        เปิดโปรแกรมแชทจำลอง
                      </button>
                      <button
                        onClick={() => handleLaunchWindow('python_code')}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-lg px-4 py-1.5 text-xs shadow-sm cursor-pointer transition-all active:scale-95"
                        id="btn-about-open-code"
                      >
                        ดูโค้ด Python & วิธีคอมไพล์
                      </button>
                    </div>
                  </div>
                )}
              </RetroWindow>
            </div>
          );
        })}
      </div>

      {/* 3. Shut down warning overlay */}
      {showShutdown && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-slate-900 border border-white/10 p-6 max-w-sm rounded-2xl shadow-2xl">
            <h2 className="text-base font-bold text-slate-100 mb-1.5 flex items-center justify-center gap-1.5">
              <Power className="text-rose-500 animate-pulse" size={18} />
              <span>Shut Down pyIRCH98?</span>
            </h2>
            <p className="text-xs text-slate-400 mb-5">คุณต้องการปิดระบบจำลองระบบแชทนี้ใช่หรือไม่?</p>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={() => {
                  setShowShutdown(false);
                  alert('ขอบคุณที่เข้ามาทดลองใช้งานครับ! ระบบกำลังกลับคืนสู่เดสก์ท็อป');
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg px-4.5 py-2 text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
                id="btn-confirm-shutdown"
              >
                Yes, Shut Down
              </button>
              <button
                onClick={() => setShowShutdown(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 font-semibold rounded-lg px-4.5 py-2 text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
                id="btn-cancel-shutdown"
              >
                No, Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom Taskbar (Translucent Dark Polish Theme) */}
      <div className="h-12 bg-slate-950/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-3 py-1 z-[999]" id="taskbar">
        <div className="flex items-center gap-2 h-full relative">
          {/* Start Button */}
          <button
            onClick={() => setStartMenuOpen(!startMenuOpen)}
            className={`h-9 px-3.5 flex items-center gap-2 font-sans font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm ${
              startMenuOpen 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white ring-1 ring-white/25' 
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/10'
            }`}
            id="start-menu-button"
          >
            {/* Start icon - modern floating geometric pieces */}
            <div className="w-4 h-4 grid grid-cols-2 gap-[2px]">
              <div className="bg-[#f43f5e] rounded-[2px] shadow-sm shadow-rose-500/20"></div>
              <div className="bg-[#10b981] rounded-[2px] shadow-sm shadow-emerald-500/20"></div>
              <div className="bg-[#3b82f6] rounded-[2px] shadow-sm shadow-blue-500/20"></div>
              <div className="bg-[#f59e0b] rounded-[2px] shadow-sm shadow-amber-500/20"></div>
            </div>
            <span className="text-[12px] font-bold tracking-wide">Start</span>
          </button>

          {/* Start Menu Panel */}
          {startMenuOpen && (
            <div
              className="absolute bottom-11 left-0 w-64 bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl flex z-[1000] select-none overflow-hidden"
              id="start-menu-panel"
            >
              {/* Left side gradient strip */}
              <div className="w-10 bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-950 flex items-end justify-center py-4">
                <span className="text-white font-sans text-[11px] font-bold rotate-270 whitespace-nowrap tracking-widest uppercase opacity-70">
                  pyIRCH98
                </span>
              </div>

              {/* Start Menu Items */}
              <div className="flex-1 flex flex-col p-1.5 text-xs font-semibold text-slate-200">
                <button
                  onClick={() => handleLaunchWindow('pirch')}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-indigo-600 hover:text-white rounded-lg transition-all group cursor-pointer"
                  id="start-menu-item-pirch"
                >
                  <MessageSquare size={14} className="text-indigo-400 group-hover:text-white" />
                  <span>pIRCH98 Client Sim</span>
                </button>
                <button
                  onClick={() => handleLaunchWindow('python_code')}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-indigo-600 hover:text-white rounded-lg transition-all group cursor-pointer"
                  id="start-menu-item-code"
                >
                  <Terminal size={14} className="text-indigo-400 group-hover:text-white" />
                  <span>Python PyQt6 Desktop Code</span>
                </button>
                <button
                  onClick={() => handleLaunchWindow('about_pirch')}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-indigo-600 hover:text-white rounded-lg transition-all group cursor-pointer"
                  id="start-menu-item-about"
                >
                  <HelpCircle size={14} className="text-rose-400 group-hover:text-white" />
                  <span>About pyIRCH98</span>
                </button>

                <div className="border-t border-white/5 my-1.5"></div>

                <button
                  onClick={() => setShowShutdown(true)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-rose-600 hover:text-white rounded-lg transition-all group cursor-pointer"
                  id="start-menu-item-shutdown"
                >
                  <Power size={14} className="text-rose-500 group-hover:text-white" />
                  <span>Shut Down...</span>
                </button>
              </div>
            </div>
          )}

          {/* Separator line */}
          <div className="h-6 w-[1px] bg-white/10 mx-1.5"></div>

          {/* List of active windows on the Taskbar */}
          <div className="flex items-center gap-1.5 h-full max-w-[50vw] sm:max-w-[70vw] overflow-x-auto overflow-y-hidden pr-2 scrollbar-none">
            {windows.map((win) => {
              if (!win.isOpen) return null;
              const isActive = win.id === activeWindowId;
              return (
                <button
                  key={win.id}
                  onClick={() => handleTaskbarClick(win.id)}
                  className={`h-9 px-3 min-w-[110px] max-w-[160px] truncate text-left font-sans text-xs flex items-center gap-2 rounded-lg transition-all select-none cursor-pointer border ${
                    isActive
                      ? 'bg-white/15 text-white border-white/20 font-bold'
                      : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10 hover:text-white'
                  }`}
                  id={`taskbar-item-${win.id}`}
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    {win.type === 'pirch' ? (
                      <MessageSquare size={11} />
                    ) : win.type === 'python_code' ? (
                      <Terminal size={11} />
                    ) : (
                      <HelpCircle size={11} />
                    )}
                  </span>
                  <span className="truncate">{win.id === 'pirch' ? 'pIRCH98' : win.id === 'python_code' ? 'Python PyQt6' : 'About'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* System tray */}
        <div className="px-3 h-9 flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 font-mono text-xs select-none" id="system-tray">
          <Volume2 size={13} className="text-slate-300" />
          <div className="h-4 w-[1px] bg-white/10"></div>
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <Clock size={12} className="text-slate-400" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
