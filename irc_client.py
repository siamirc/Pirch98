import sys
import socket
import re
import threading
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QTextBrowser, QLabel, QSplitter,
    QListWidget, QStatusBar, QMessageBox, QFrame
)
from PyQt6.QtCore import QThread, pyqtSignal, QObject, Qt
from PyQt6.QtGui import QFont, QColor

# =====================================================================
# 1. คลาส IRCWorker สำหรับจัดการเชื่อมต่อและรับส่งข้อมูลผ่าน TCP Socket
# ทำงานใน Thread แยกต่างหาก (QThread) เพื่อป้องกันไม่ให้หน้าจอโปรแกรมค้าง (Freeze)
# =====================================================================
class IRCWorker(QObject):
    # สร้าง Signals เพื่อส่งข้อมูลกลับไปยัง GUI Main Thread อย่างปลอดภัย
    connected = pyqtSignal()
    disconnected = pyqtSignal()
    registered = pyqtSignal()                   # ลงทะเบียนสำเร็จ (ได้รับ 001)
    message_received = pyqtSignal(str, str, str) # (channel/sender, nick, message)
    system_message = pyqtSignal(str)            # ข้อความระบบ/Log
    user_joined = pyqtSignal(str, str)           # (channel, nick)
    user_left = pyqtSignal(str, str)             # (channel, nick)
    user_list_received = pyqtSignal(str, list)   # (channel, list of nicks)
    error_occurred = pyqtSignal(str)

    def __init__(self, server, port, nickname, username="pyIRCH", realname="PyQt6 pIRCH Client"):
        super().__init__()
        self.server = server
        self.port = port
        self.nickname = nickname
        self.username = username
        self.realname = realname
        self.socket = None
        self.is_running = False

    def stop(self):
        """ สั่งให้เธรดหยุดทำงานและทำความสะอาด """
        self.is_running = False
        self.cleanup()

    def run(self):
        """ ฟังก์ชันหลักที่จะรันในเธรดแยก """
        self.is_running = True
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10) # ตั้ง timeout ป้องกันค้างตอนต่อไม่ติด
            self.system_message.emit(f"กำลังเชื่อมต่อไปยัง {self.server}:{self.port}...")
            
            self.socket.connect((self.server, self.port))
            self.socket.settimeout(None) # ปลด timeout หลังเชื่อมต่อสำเร็จ
            
            self.connected.emit()
            self.system_message.emit("เชื่อมต่อสำเร็จ! กำลังลงทะเบียน Nickname...")
            
            # ส่งข้อมูลลงทะเบียน IRC Protocol
            self.send_line(f"NICK {self.nickname}")
            self.send_line(f"USER {self.username} 0 * :{self.realname}")
            
            buffer = ""
            while self.is_running:
                # รับข้อมูลจาก Socket (ขนาด 4096 bytes)
                data = self.socket.recv(4096)
                if not data:
                    self.system_message.emit("เซิร์ฟเวอร์ตัดการเชื่อมต่อ (Connection closed by remote host)")
                    break
                
                # แปลงข้อมูลเป็น string และแยกเป็นบรรทัดตามมาตรฐาน IRC (\r\n)
                buffer += data.decode("utf-8", errors="ignore")
                lines = buffer.split("\r\n")
                buffer = lines.pop() # เก็บส่วนที่อาจจะได้รับมาไม่ครบไว้ใน buffer
                
                for line in lines:
                    if not line:
                        continue
                    self.parse_line(line)
                    
        except Exception as e:
            self.error_occurred.emit(str(e))
        finally:
            self.cleanup()

    def send_line(self, line):
        """ ส่งข้อความผ่าน Socket ไปยัง IRC Server """
        if self.socket and self.is_running:
            try:
                self.socket.sendall((line + "\r\n").encode("utf-8"))
            except Exception as e:
                self.error_occurred.emit(f"ส่งข้อมูลล้มเหลว: {e}")

    def parse_line(self, line):
        """ แกะโปรโตคอล IRC เพื่อดูว่าเป็นข้อความประเภทใด """
        # ตอบกลับ PING ของเซิร์ฟเวอร์โดยอัตโนมัติ เพื่อไม่ให้โดนตัดการเชื่อมต่อ (Ping Timeout)
        if line.startswith("PING"):
            payload = line.split(" ", 1)[1] if " " in line else ""
            self.send_line(f"PONG {payload}")
            return

        # ตัวอย่างข้อความ: :nick!user@host PRIVMSG #channel :hello world
        # หรือข้อความระบบ: :irc.server.com 001 nickname :Welcome to the Internet Relay Network...
        match = re.match(r"^:([^ ]+) ([^ ]+) ([^ ]+)( :?(.*))?$", line)
        if match:
            prefix, command, target, _, params = match.groups()
            sender_nick = prefix.split("!")[0] if "!" in prefix else prefix
            
            if command == "PRIVMSG":
                self.message_received.emit(target, sender_nick, params)
            elif command == "001":
                self.registered.emit()
                self.system_message.emit(f"ลงทะเบียนสำเร็จ: {params}")
            elif command == "JOIN":
                channel = target.lstrip(":")
                self.user_joined.emit(channel, sender_nick)
            elif command == "PART":
                channel = target
                self.user_left.emit(channel, sender_nick)
            elif command == "QUIT":
                self.user_left.emit("ALL", sender_nick)
            elif command == "353": # รหัสแสดงรายชื่อผู้ใช้ในห้อง (RPL_NAMREPLY)
                # รูปแบบ: :server 353 nick = #channel :nick1 nick2 nick3...
                try:
                    chan_part = line.split(" = ")[1]
                    channel = chan_part.split(" :")[0]
                    users = chan_part.split(" :")[1].strip().split(" ")
                    self.user_list_received.emit(channel, users)
                except Exception:
                    pass
            elif command in ["372", "375", "376"]: # ข้อความ MOTD (Message of the Day)
                self.system_message.emit(f"[MOTD] {params}")
            else:
                # ข้อความระบบอื่นๆ
                self.system_message.emit(f"[{command}] {params if params else line}")
        else:
            # ข้อความทั่วไป
            self.system_message.emit(line)

    def cleanup(self):
        """ ปิด Socket และทำความสะอาดออบเจกต์ """
        self.is_running = False
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None
        self.disconnected.emit()


# =====================================================================
# 2. คลาสหลัก GUI Window หน้าตาคล้ายโปรแกรม pIRCH (สไตล์ Windows 95)
# =====================================================================
class PIRCHMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("pyIRCH98 - Classic IRC Client")
        self.resize(800, 600)
        
        # ตัวแปรสำหรับ Thread และ Connection
        self.irc_thread = None
        self.irc_worker = None
        self.current_channel = ""
        
        # เริ่มสร้างส่วนติดต่อผู้ใช้ (UI)
        self.init_ui()
        self.apply_modern_style()

    def init_ui(self):
        # Widget หลัก
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(6, 6, 6, 6)
        main_layout.setSpacing(6)

        # ----------------------------------------------------
        # ส่วนบน: แถบตั้งค่าและเชื่อมต่อ Server / Nick (สไตล์ pIRCH)
        # ----------------------------------------------------
        top_frame = QFrame()
        top_frame.setObjectName("TopFrame")
        top_frame.setFrameShape(QFrame.Shape.StyledPanel)
        top_layout = QHBoxLayout(top_frame)
        top_layout.setContentsMargins(8, 8, 8, 8)
        top_layout.setSpacing(10)

        # ช่องใส่ Server
        top_layout.addWidget(QLabel("Server:"))
        self.server_input = QLineEdit("irc.thaiirc.com")
        self.server_input.setPlaceholderText("e.g. irc.thaiirc.com")
        top_layout.addWidget(self.server_input)

        # ช่องใส่ Port
        top_layout.addWidget(QLabel("Port:"))
        self.port_input = QLineEdit("6667")
        self.port_input.setFixedWidth(50)
        top_layout.addWidget(self.port_input)

        # ช่องใส่ Nickname
        top_layout.addWidget(QLabel("Nick:"))
        self.nick_input = QLineEdit("pyIRCH_Guest")
        self.nick_input.setFixedWidth(100)
        top_layout.addWidget(self.nick_input)

        # ช่องใส่ Channel ที่ต้องการ Join หลังจาก Connect สำเร็จ
        top_layout.addWidget(QLabel("Join Chan:"))
        self.channel_input = QLineEdit("#pyqt6")
        self.channel_input.setFixedWidth(80)
        top_layout.addWidget(self.channel_input)

        # ปุ่มเชื่อมต่อ Connect/Disconnect
        self.connect_btn = QPushButton("Connect")
        self.connect_btn.setFixedWidth(100)
        self.connect_btn.clicked.connect(self.toggle_connection)
        top_layout.addWidget(self.connect_btn)

        main_layout.addWidget(top_frame)

        # ----------------------------------------------------
        # ส่วนกลาง: หน้าต่างแชทและรายชื่อผู้ใช้แยกฝั่งซ้ายขวา (Splitter)
        # ----------------------------------------------------
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # ฝั่งซ้าย: หน้าต่างแชทแสดงข้อความ (Chat Window)
        self.chat_display = QTextBrowser()
        self.chat_display.setObjectName("ChatDisplay")
        self.chat_display.setOpenExternalLinks(True)
        # ใส่ Welcome Message สไตล์โมเดิร์น (สว่าง)
        self.chat_display.append(
            "<div style='margin-bottom: 8px;'><span style='color: #4f46e5; font-weight: bold; font-size: 14px;'>🚀 ยินดีต้อนรับสู่ pyIRCH98 Client (Modern Light Edition)</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #10b981; font-weight: bold;'>✔ ระบบแยกเธรด (Multithreading) ทำงานเบื้องหลังด้วย QThread ไม่ค้าง 100%</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #475569;'>✔ ออกแบบอินเตอร์เฟสใหม่หมดจดสไตล์พรีเมียม โค้งมน ทันสมัย ไร้เส้นกรอบกวนสายตา</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #ec4899; font-weight: bold;'>✔ ลองพิมพ์แชทจำลองคุยกับบอท หรือใช้คำสั่ง เช่น /join #room, /nick name ได้ทันที</span></div>"
        )
        splitter.addWidget(self.chat_display)

        # ฝั่งขวา: รายชื่อคนในช่องแชท (Users List)
        self.user_list = QListWidget()
        self.user_list.setObjectName("UserList")
        self.user_list.setFixedWidth(150)
        splitter.addWidget(self.user_list)
        
        splitter.setSizes([600, 150])
        main_layout.addWidget(splitter, stretch=1)

        # ----------------------------------------------------
        # ส่วนล่าง: ช่องพิมพ์ส่งข้อความแชท และส่งคำสั่ง
        # ----------------------------------------------------
        bottom_layout = QHBoxLayout()
        bottom_layout.setSpacing(6)

        self.message_input = QLineEdit()
        self.message_input.setPlaceholderText("พิมพ์ข้อความแชท หรือพิมพ์คำสั่ง เช่น /join #pyqt6 จากนั้นกด Enter...")
        self.message_input.returnPressed.connect(self.send_message)
        bottom_layout.addWidget(self.message_input)

        self.send_btn = QPushButton("Send")
        self.send_btn.clicked.connect(self.send_message)
        self.send_btn.setFixedWidth(80)
        bottom_layout.addWidget(self.send_btn)

        main_layout.addLayout(bottom_layout)

        # ----------------------------------------------------
        # แถบสถานะด้านล่างสุด (Status Bar)
        # ----------------------------------------------------
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("พร้อมใช้งาน (Status: Offline)")

    def toggle_connection(self):
        """ ฟังก์ชันสลับสถานะเชื่อมต่อ/ตัดการเชื่อมต่อ """
        if self.irc_thread and self.irc_thread.isRunning():
            self.disconnect_irc()
        else:
            self.connect_irc()

    def connect_irc(self):
        server = self.server_input.text().strip()
        port_str = self.port_input.text().strip()
        nick = self.nick_input.text().strip()
        
        if not server or not port_str or not nick:
            QMessageBox.warning(self, "ข้อมูลไม่ครบ", "กรุณากรอก Server, Port และ Nick ให้ครบถ้วน")
            return

        try:
            port = int(port_str)
        except ValueError:
            QMessageBox.warning(self, "Port ไม่ถูกต้อง", "Port ต้องเป็นตัวเลขเท่านั้น")
            return

        # 1. สร้าง Thread ใหม่
        self.irc_thread = QThread()
        
        # 2. สร้าง IRCWorker ออบเจกต์
        self.irc_worker = IRCWorker(server, port, nick)
        
        # 3. ย้าย Worker ไปทำงานใน Thread แยก
        self.irc_worker.moveToThread(self.irc_thread)
        
        # 4. เชื่อมโยง Signals ของ Worker เข้ากับ Slot Functions ใน GUI Main Thread
        self.irc_thread.started.connect(self.irc_worker.run)
        self.irc_worker.connected.connect(self.on_irc_connected)
        self.irc_worker.disconnected.connect(self.on_irc_disconnected)
        self.irc_worker.system_message.connect(self.append_system_msg)
        self.irc_worker.message_received.connect(self.on_message_received)
        self.irc_worker.user_joined.connect(self.on_user_joined)
        self.irc_worker.user_left.connect(self.on_user_left)
        self.irc_worker.user_list_received.connect(self.on_user_list)
        self.irc_worker.registered.connect(self.on_irc_registered)
        self.irc_worker.error_occurred.connect(self.on_error)
        
        # เมื่อ Thread จบการทำงาน ให้ทำความสะอาดหน่วยความจำ
        self.irc_thread.finished.connect(self.irc_thread.deleteLater)
        self.irc_worker.disconnected.connect(self.irc_worker.deleteLater)
        
        # 5. เริ่มรัน Thread
        self.irc_thread.start()
        
        self.connect_btn.setText("Connecting...")
        self.connect_btn.setEnabled(False)
        self.status_bar.showMessage("กำลังกำลังพยายามเชื่อมต่อ...")

    def disconnect_irc(self):
        """ ตัดการเชื่อมต่ออย่างเป็นระบบและปลอดภัย """
        if self.irc_worker:
            self.status_bar.showMessage("กำลังตัดการเชื่อมต่อ...")
            # ส่งคำสั่ง QUIT ไปแจ้งเซิร์ฟเวอร์ก่อนปิด Socket
            self.irc_worker.send_line("QUIT :Leaving with pyIRCH98")
            self.irc_worker.stop()
        
        if self.irc_thread:
            self.irc_thread.quit()
            self.irc_thread.wait(2000) # รอสูงสุด 2 วินาทีให้ Thread ปิดสนิท

    def on_irc_connected(self):
        """ ทำงานหลังจาก Socket ต่อติดเสร็จสิ้น """
        self.connect_btn.setText("Disconnect")
        self.connect_btn.setEnabled(True)
        self.status_bar.showMessage("เชื่อมต่อแล้ว! กำลังลงทะเบียน Nickname กับเซิร์ฟเวอร์...")
        self.server_input.setEnabled(False)
        self.port_input.setEnabled(False)
        self.nick_input.setEnabled(False)

    def on_irc_registered(self):
        """ ทำงานหลังจากลงทะเบียนสำเร็จ (ได้รับ 001) """
        self.status_bar.showMessage("ลงทะเบียน Nickname สำเร็จ (Online)")
        # เข้าร่วมห้องแชทอัตโนมัติหากมีการระบุไว้
        auto_chan = self.channel_input.text().strip()
        if auto_chan:
            if not auto_chan.startswith("#"):
                auto_chan = "#" + auto_chan
            self.current_channel = auto_chan
            self.irc_worker.send_line(f"JOIN {auto_chan}")

    def on_irc_disconnected(self):
        """ ทำงานเมื่อปิดการเชื่อมต่อ """
        self.connect_btn.setText("Connect")
        self.connect_btn.setEnabled(True)
        self.status_bar.showMessage("ตัดการเชื่อมต่อแล้ว (Offline)")
        self.server_input.setEnabled(True)
        self.port_input.setEnabled(True)
        self.nick_input.setEnabled(True)
        self.user_list.clear()
        self.current_channel = ""

    def append_system_msg(self, text):
        """ เพิ่มข้อความระบบสไตล์โมเดิร์นลงหน้าจอแชท """
        self.chat_display.append(f"<span style='color: #0891b2;'>• {text}</span>")

    def on_message_received(self, target, nick, message):
        """ เมื่อได้รับข้อความแชท """
        is_me = nick == self.nick_input.text().strip()
        nick_color = "#4f46e5" if is_me else "#059669"
        text_color = "#1e293b"
        msg_html = f"<div style='margin: 3px 0;'><b style='color: {nick_color};'>&lt;{nick}&gt;</b> <span style='color: {text_color};'>{message}</span></div>"
        self.chat_display.append(msg_html)

    def on_user_joined(self, channel, nick):
        """ มีคนอื่น หรือตัวเราเอง Join เข้ามาในห้องแชท """
        self.append_system_msg(f"<b>{nick}</b> ได้เข้าสู่ห้อง {channel}")
        if nick == self.nick_input.text().strip():
            self.current_channel = channel
            self.chat_display.append(f"<span style='color: #059669; font-weight: bold;'>✔ ย้ายเข้าห้อง {channel} เรียบร้อยแล้ว</span>")
        
        # อัปเดตรายชื่อ (ส่งคำสั่ง NAMES เพื่อดึงข้อมูลรายชื่อใหม่)
        if self.irc_worker:
            self.irc_worker.send_line(f"NAMES {channel}")

    def on_user_left(self, channel, nick):
        """ มีคนออกจากห้องแชท หรือออกจากระบบ """
        self.append_system_msg(f"<b>{nick}</b> ได้ออกจากห้อง {channel if channel != 'ALL' else ''}")
        
        # ค้นหาและลบรายชื่อออกจาก UserList
        items = self.user_list.findItems(nick, Qt.MatchFlag.MatchExactly)
        for item in items:
            self.user_list.takeItem(self.user_list.row(item))

    def on_user_list(self, channel, users):
        """ ได้รับรายชื่อผู้ใช้ทั้งหมดในห้องแชท """
        if channel.lower() == self.current_channel.lower():
            self.user_list.clear()
            for user in users:
                if user:
                    clean_user = user.lstrip("@+") # ลบตัวแสดงสถานะแอดมิน/วอยซ์ ออกเพื่อความเป็นระเบียบ
                    self.user_list.addItem(clean_user)

    def on_error(self, err_msg):
        """ จัดการกรณีเกิดข้อผิดพลาดขึ้นในเธรด socket """
        self.chat_display.append(f"<span style='color: #f87171;'><b>[ข้อผิดพลาด]</b> {err_msg}</span>")
        self.disconnect_irc()

    def send_message(self):
        """ ส่งข้อความแชท หรือพิมพ์คำสั่ง """
        text = self.message_input.text().strip()
        if not text:
            return
        
        self.message_input.clear()

        # กรณีผู้ใช้พิมพ์คำสั่ง IRC Command ขึ้นต้นด้วยเครื่องหมาย / (Slash)
        if text.startswith("/"):
            parts = text[1:].split(" ", 1)
            cmd = parts[0].upper()
            args = parts[1] if len(parts) > 1 else ""
            
            if cmd == "JOIN":
                if not args.startswith("#"):
                    args = "#" + args
                self.current_channel = args
                if self.irc_worker:
                    self.irc_worker.send_line(f"JOIN {args}")
            elif cmd == "PART":
                chan = args if args else self.current_channel
                if chan and self.irc_worker:
                    self.irc_worker.send_line(f"PART {chan}")
                    self.user_list.clear()
                    self.current_channel = ""
            elif cmd == "NICK":
                if args and self.irc_worker:
                    self.irc_worker.send_line(f"NICK {args}")
                    self.nick_input.setText(args)
            elif cmd == "QUIT":
                self.disconnect_irc()
            elif cmd == "RAW":
                if args and self.irc_worker:
                    self.irc_worker.send_line(args)
            else:
                self.chat_display.append(f"<span style='color: #f87171;'>* คำสั่ง /{cmd} ไม่รองรับในไคลเอนต์เบื้องต้นนี้</span>")
        else:
            # ส่งแชทธรรมดาเข้าห้องแชทปัจจุบัน
            if not self.current_channel:
                self.chat_display.append("<span style='color: #94a3b8;'>* กรุณาเข้าร่วมห้องแชทก่อนส่งข้อความ (พิมพ์ /join #ชื่อห้องแชท)</span>")
                return
            
            if self.irc_worker:
                # ส่งโปรโตคอล PRIVMSG
                self.irc_worker.send_line(f"PRIVMSG {self.current_channel} :{text}")
                # แสดงข้อความตัวเองขึ้นหน้าจอแชททันที
                my_nick = self.nick_input.text()
                self.on_message_received(self.current_channel, my_nick, text)

    def apply_modern_style(self):
        """ ปรับแต่งหน้าตาโปรแกรมให้เป็นสไตล์ Modern UI เกรดพรีเมียม (แบบใน Simulator) """
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f8fafc;
            }
            QLabel {
                font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', 'Arial';
                font-size: 11px;
                color: #475569;
                font-weight: bold;
            }
            #TopFrame {
                background-color: #f1f5f9;
                border: none;
                border-radius: 12px;
            }
            QLineEdit {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                font-family: 'Segoe UI', 'Inter', 'Arial', monospace;
                font-size: 12px;
                padding: 6px 10px;
                color: #1e293b;
            }
            QLineEdit:focus {
                border: 1px solid #6366f1;
            }
            QPushButton {
                background-color: #6366f1;
                border: none;
                border-radius: 8px;
                font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', 'Arial';
                font-size: 11px;
                font-weight: bold;
                padding: 6px 14px;
                color: #ffffff;
            }
            QPushButton:hover {
                background-color: #4f46e5;
            }
            QPushButton:pressed {
                background-color: #4338ca;
            }
            QPushButton:disabled {
                background-color: #e2e8f0;
                border: none;
                color: #94a3b8;
            }
            #ChatDisplay {
                background-color: #ffffff;
                border: none;
                border-radius: 12px;
                font-family: 'Segoe UI', 'Inter', 'Arial';
                font-size: 12px;
                color: #1e293b;
                padding: 12px;
            }
            #UserList {
                background-color: #f1f5f9;
                border: none;
                border-radius: 12px;
                font-family: 'Segoe UI', 'Inter', 'Arial';
                font-size: 11px;
                color: #334155;
                padding: 6px;
            }
            QListWidget::item {
                padding: 5px 8px;
                border-radius: 6px;
                color: #334155;
            }
            QListWidget::item:hover {
                background-color: #e2e8f0;
                color: #0f172a;
            }
            QListWidget::item:selected {
                background-color: #6366f1;
                color: #ffffff;
                font-weight: bold;
            }
            QStatusBar {
                background-color: #f8fafc;
                border-top: none;
                color: #64748b;
                font-size: 11px;
                font-family: 'Segoe UI', 'Inter', 'Arial';
            }
            QSplitter::handle {
                background-color: transparent;
            }
        """)

    def closeEvent(self, event):
        """ ดักเหตุการณ์ปิดโปรแกรม เพื่อให้ปิด Thread อย่างปลอดภัย """
        self.disconnect_irc()
        event.accept()


# =====================================================================
# 3. จุดเริ่มต้นรันโปรแกรม (Entry Point)
# =====================================================================
if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # ตั้งค่าฟอนต์มาตรฐานของแอปพลิเคชัน
    font = QFont("Tahoma", 9)
    app.setFont(font)
    
    window = PIRCHMainWindow()
    window.show()
    sys.exit(app.exec())
