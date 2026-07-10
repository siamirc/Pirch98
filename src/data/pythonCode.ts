export const pythonCodeString = `import sys
import socket
import re
import threading
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QTextBrowser, QLabel, QSplitter,
    QListWidget, QStatusBar, QMessageBox, QFrame, QTabWidget
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
    user_kicked = pyqtSignal(str, str, str, str) # (channel, kicked_nick, kicker_nick, reason)
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
                
                # แปลงข้อมูลเป็น string และแยกเป็นบรรทัดตามมาตรฐาน IRC (\\r\\n)
                buffer += data.decode("utf-8", errors="ignore")
                lines = buffer.split("\\r\\n")
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
                self.socket.sendall((line + "\\r\\n").encode("utf-8"))
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
            elif command == "KICK":
                channel = target
                parts = params.split(" ", 1)
                kicked_nick = parts[0]
                reason = parts[1].lstrip(":") if len(parts) > 1 else "Kicked"
                self.user_kicked.emit(channel, kicked_nick, sender_nick, reason)
            elif command == "353": # รหัสแสดงรายชื่อผู้ใช้ในห้อง (RPL_NAMREPLY)
                # รูปแบบทั่วไป: :server 353 nick = #channel :nick1 nick2 nick3... (หรืออาจเป็น @ หรือ *)
                try:
                    # แยกส่วนผู้ใช้ออกมาด้วย " :" แรกที่อยู่หลังตัวระบุคำสั่ง 353
                    parts = line.split(" :", 1)
                    if len(parts) == 2:
                        user_list_str = parts[1]
                        users = user_list_str.strip().split(" ")
                        
                        # แยกหาชื่อช่องแคบจากฝั่งซ้าย (ตัวสุดท้ายก่อนเครื่องหมายแยก)
                        left_part = parts[0].strip()
                        left_words = left_part.split(" ")
                        channel = left_words[-1]
                        
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
        self.rooms = {}
        self.current_theme = "light"
        self.font_size_idx = 1 # 0: เล็ก, 1: กลาง, 2: ใหญ่
        
        # เริ่มสร้างส่วนติดต่อผู้ใช้ (UI)
        self.init_ui()
        self.apply_theme("light")
        self.update_font_size()

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
        self.connect_btn.setFixedWidth(90)
        self.connect_btn.clicked.connect(self.toggle_connection)
        top_layout.addWidget(self.connect_btn)

        # ปุ่มสลับ Theme โหมดมืด/สว่าง
        self.theme_btn = QPushButton("🌙 Dark Mode")
        self.theme_btn.setFixedWidth(100)
        self.theme_btn.clicked.connect(self.toggle_theme)
        top_layout.addWidget(self.theme_btn)

        # ปุ่มปรับขนาดตัวอักษร 3 ระดับ
        self.font_btn = QPushButton("🔍 ขนาด: กลาง")
        self.font_btn.setFixedWidth(100)
        self.font_btn.clicked.connect(self.change_font_size)
        top_layout.addWidget(self.font_btn)

        main_layout.addWidget(top_frame)

        # ----------------------------------------------------
        # ส่วนกลาง: แถบแท็บแยกห้องสนทนา (Status / MOTD / Channels)
        # ----------------------------------------------------
        self.tab_widget = QTabWidget()
        self.tab_widget.setObjectName("ChannelTabs")
        main_layout.addWidget(self.tab_widget, stretch=1)

        # แท็บสถานะระบบ (Status Tab)
        self.status_widget = QWidget()
        status_layout = QVBoxLayout(self.status_widget)
        status_layout.setContentsMargins(4, 4, 4, 4)
        self.status_display = QTextBrowser()
        self.status_display.setObjectName("StatusDisplay")
        self.status_display.setOpenExternalLinks(True)
        self.status_display.append(
            "<div style='margin-bottom: 8px;'><span style='color: #4f46e5; font-weight: bold; font-size: 14px;'>🚀 ยินดีต้อนรับสู่ pyIRCH98 Client (Modern Tabbed Edition)</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #10b981; font-weight: bold;'>✔ ระบบแยกเธรด (Multithreading) ทำงานเบื้องหลังด้วย QThread ไม่ค้าง 100%</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #475569;'>✔ ออกแบบอินเตอร์เฟสใหม่แยกแท็บห้องแชทเดี่ยว เพื่อป้องกันไม่ให้ข้อความสับสนผสมปนเปกัน</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #0891b2; font-weight: bold;'>✔ เมนูพิเศษข่าวสารเซิร์ฟเวอร์ (MOTD) ถูกแยกออกจากห้องแชทหลักเรียบร้อย</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #ec4899; font-weight: bold;'>✔ จัดลำดับสิทธิ์ผู้ใช้งานจาก Operator (@) -> Voice (+) -> ผู้ใช้ทั่วไป อย่างถูกต้องเรียบร้อย</span></div>"
        )
        status_layout.addWidget(self.status_display)
        self.tab_widget.addTab(self.status_widget, "Status")

        # แท็บข่าวสารเซิร์ฟเวอร์ (MOTD Tab)
        self.motd_widget = QWidget()
        motd_layout = QVBoxLayout(self.motd_widget)
        motd_layout.setContentsMargins(4, 4, 4, 4)
        self.motd_display = QTextBrowser()
        self.motd_display.setObjectName("MOTDDisplay")
        self.motd_display.setOpenExternalLinks(True)
        self.motd_display.append(
            "<div style='margin-bottom: 8px;'><span style='color: #800080; font-weight: bold; font-size: 14px;'>📰 ข่าวสารจากเซิร์ฟเวอร์ (Message of the Day - MOTD)</span></div>"
            "<div style='margin-bottom: 4px;'><span style='color: #64748b;'>ข้อมูลข่าวสาร นโยบาย และประกาศของเซิร์ฟเวอร์จะปรากฏแยกต่างหากที่แท็บนี้เมื่อเชื่อมต่อสำเร็จ เพื่อความเป็นระเบียบเรียบร้อย</span></div>"
        )
        motd_layout.addWidget(self.motd_display)
        self.tab_widget.addTab(self.motd_widget, "MOTD")

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

    def get_or_create_channel_tab(self, channel):
        """ ค้นหาหรือสร้างแถบห้องแชทใหม่แยกต่างหากสำหรับ channel """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            return self.rooms[chan_key]
        
        # สร้าง Widget สำหรับแท็บนี้
        chan_widget = QWidget()
        chan_layout = QVBoxLayout(chan_widget)
        chan_layout.setContentsMargins(4, 4, 4, 4)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setObjectName("ChanSplitter")
        
        chat_display = QTextBrowser()
        chat_display.setObjectName("ChatDisplay")
        chat_display.setOpenExternalLinks(True)
        splitter.addWidget(chat_display)
        
        user_list = QListWidget()
        user_list.setObjectName("UserList")
        splitter.addWidget(user_list)
        
        splitter.setSizes([640, 160])
        splitter.setStretchFactor(0, 80)
        splitter.setStretchFactor(1, 20)
        chan_layout.addWidget(splitter)
        
        self.tab_widget.addTab(chan_widget, channel)
        
        room_data = {
            "widget": chan_widget,
            "chat_display": chat_display,
            "user_list": user_list,
            "users": []
        }
        self.rooms[chan_key] = room_data
        
        # เลือกไปที่แท็บที่สร้างขึ้นใหม่ทันที
        self.tab_widget.setCurrentWidget(chan_widget)
        
        # อัปเดตสไตล์ของ Widget ใหม่ให้เข้ากับ Theme ปัจจุบัน
        self.apply_theme(self.current_theme)
        
        return room_data

    def remove_channel_tab(self, channel):
        """ ลบแท็บห้องแชทออกเมื่อ PART หรือออกจากห้อง """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            room_data = self.rooms[chan_key]
            idx = self.tab_widget.indexOf(room_data["widget"])
            if idx != -1:
                self.tab_widget.removeTab(idx)
            del self.rooms[chan_key]
            # สลับกลับไปที่แท็บ Status
            self.tab_widget.setCurrentIndex(0)

    def toggle_theme(self):
        """ สลับธีมระหว่างสว่างกับมืด """
        if self.current_theme == "light":
            self.apply_theme("dark")
        else:
            self.apply_theme("light")

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
        self.irc_worker.user_kicked.connect(self.on_user_kicked)
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
            self.get_or_create_channel_tab(auto_chan)
            self.irc_worker.send_line(f"JOIN {auto_chan}")

    def on_irc_disconnected(self):
        """ ทำงานเมื่อปิดการเชื่อมต่อ """
        self.connect_btn.setText("Connect")
        self.connect_btn.setEnabled(True)
        self.status_bar.showMessage("ตัดการเชื่อมต่อแล้ว (Offline)")
        self.server_input.setEnabled(True)
        self.port_input.setEnabled(True)
        self.nick_input.setEnabled(True)
        
        # ลบห้องสนทนาทั้งหมดออก
        for chan_key in list(self.rooms.keys()):
            self.remove_channel_tab(chan_key)
            
        self.current_channel = ""

    def append_system_msg(self, text):
        """ เพิ่มข้อความระบบลงหน้าจอ Status หรือข่าวสาร MOTD """
        # หากตรวจพบคีย์เวิร์ด MOTD ให้นำข่าวสารไปลงในแท็บ MOTD
        if "[MOTD]" in text or "MOTD" in text:
            self.motd_display.append(f"<span style='color: #800080;'>• {text}</span>")
            return

        # เพิ่มลงในแท็บปัจจุบันที่เปิดอยู่
        current_idx = self.tab_widget.currentIndex()
        current_text = self.tab_widget.tabText(current_idx)
        current_text_clean = current_text.split(" (")[0]
        
        text_color = "#0891b2" if self.current_theme == "light" else "#38bdf8"
        msg_html = f"<span style='color: {text_color};'>• {text}</span>"
        
        if current_text_clean.lower() in self.rooms:
            self.rooms[current_text_clean.lower()]["chat_display"].append(msg_html)
        elif current_text == "MOTD":
            self.motd_display.append(msg_html)
        else:
            self.status_display.append(msg_html)

    def on_message_received(self, target, nick, message):
        """ เมื่อได้รับข้อความแชท """
        is_me = nick == self.nick_input.text().strip()
        nick_color = "#4f46e5" if is_me else "#059669"
        
        text_color = "#0f172a" if self.current_theme == "light" else "#f1f5f9"
        msg_html = f"<div style='margin: 3px 0;'><b>&lt;<span style='color: {nick_color};'>{nick}</span>&gt;</b> <span style='color: {text_color};'>{message}</span></div>"
        
        target_key = target.lower()
        if target_key in self.rooms:
            self.rooms[target_key]["chat_display"].append(msg_html)
        else:
            # หากเป็นช่องใหม่ที่ยังไม่มีแท็บ ให้สร้างแถบสนทนาใหม่
            if target.startswith("#"):
                room = self.get_or_create_channel_tab(target)
                room["chat_display"].append(msg_html)
            else:
                # กรณีเป็นข้อความกระซิบเดี่ยว (Private Message) ให้แสดงไว้ที่ห้อง Status พร้อมข้อความระบุชัดเจน
                self.status_display.append(f"<div style='margin: 3px 0;'><b style='color: #ec4899;'>[กระซิบจาก {nick}]</b> <span style='color: {text_color};'>{message}</span></div>")

    def clean_nick(self, nick):
        """ ล้างค่าสัญลักษณ์หน้าชื่อผู้ใช้งาน เช่น @, +, %, & และ ~ """
        return nick.lstrip("@+%&~")

    def add_user_to_list(self, channel, nick):
        """ เพิ่มผู้ใช้งานเข้าสู่ห้องแชทจำลอง/จริงแบบเรียลไทม์ และป้องกันชื่อซ้ำ """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            room = self.rooms[chan_key]
            clean_new_nick = self.clean_nick(nick)
            # ลบชื่อเก่าที่อาจจะชนกันออกก่อน
            room["users"] = [u for u in room["users"] if self.clean_nick(u) != clean_new_nick]
            room["users"].append(nick)
            self.update_user_list_ui(channel, room["users"])

    def remove_user_from_list(self, channel, nick):
        """ ลบผู้ใช้งานออกจากห้องแชทจำลอง/จริงแบบเรียลไทม์ """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            room = self.rooms[chan_key]
            clean_target_nick = self.clean_nick(nick)
            room["users"] = [u for u in room["users"] if self.clean_nick(u) != clean_target_nick]
            self.update_user_list_ui(channel, room["users"])

    def remove_user_from_all_lists(self, nick):
        """ ลบผู้ใช้งานออกจากทุกห้องแชท (เมื่อ QUIT หรือหลุดออกจากเซิร์ฟเวอร์) """
        clean_target_nick = self.clean_nick(nick)
        for chan_key in list(self.rooms.keys()):
            room = self.rooms[chan_key]
            orig_len = len(room["users"])
            room["users"] = [u for u in room["users"] if self.clean_nick(u) != clean_target_nick]
            if len(room["users"]) != orig_len:
                # หาชื่อแท้จริงของช่องแชทจากแถบแท็บเพื่ออัปเดต UI ให้ถูกต้อง
                channel_name = chan_key
                for i in range(self.tab_widget.count()):
                    tab_text = self.tab_widget.tabText(i).split(" (")[0]
                    if tab_text.lower() == chan_key:
                        channel_name = tab_text
                        break
                self.update_user_list_ui(channel_name, room["users"])

    def on_user_joined(self, channel, nick):
        """ มีคนอื่น หรือตัวเราเอง Join เข้ามาในห้องแชท """
        room = self.get_or_create_channel_tab(channel)
        
        text_color = "#059669" if self.current_theme == "light" else "#10b981"
        room["chat_display"].append(f"<span style='color: {text_color}; font-weight: bold;'>✔ {nick} ได้เข้าสู่ห้อง {channel}</span>")
        
        if nick == self.nick_input.text().strip():
            self.current_channel = channel
            
        # เพิ่มเข้าสู่ผู้ใช้งานของระบบแชทแบบเรียลไทม์ทันที
        self.add_user_to_list(channel, nick)

    def on_user_left(self, channel, nick):
        """ มีคนออกจากห้องแชท หรือออกจากระบบ """
        if channel != "ALL":
            chan_key = channel.lower()
            if chan_key in self.rooms:
                room = self.rooms[chan_key]
                text_color = "#94a3b8" if self.current_theme == "light" else "#64748b"
                room["chat_display"].append(f"<span style='color: {text_color};'>🚪 {nick} ได้ออกจากห้อง {channel}</span>")
                
                # หากตัวเราออกจากช่องเอง ให้ทำการปิดแท็บ
                if nick == self.nick_input.text().strip():
                    self.remove_channel_tab(channel)
                    if self.current_channel == channel:
                        self.current_channel = ""
                else:
                    self.remove_user_from_list(channel, nick)
        else:
            # กรณีหลุดออกจากระบบทั้งหมด ให้ลบผู้ใช้รายนี้ออกจากทุกห้องแชททันที
            self.remove_user_from_all_lists(nick)

    def on_user_kicked(self, channel, kicked_nick, kicker_nick, reason):
        """ เมื่อมีคนถูกเตะออกจากห้องแชท (KICK event) """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            room = self.rooms[chan_key]
            text_color = "#ef4444" if self.current_theme == "light" else "#f87171"
            room["chat_display"].append(f"<span style='color: {text_color}; font-weight: bold;'>❌ {kicked_nick} ถูกเตะออกจากห้อง {channel} โดย {kicker_nick} ({reason})</span>")
            
            # หากเป็นตัวเราเองโดนเตะ ให้ปิดแท็บห้องแชทนั้น
            if kicked_nick == self.nick_input.text().strip():
                self.remove_channel_tab(channel)
                if self.current_channel == channel:
                    self.current_channel = ""
            else:
                self.remove_user_from_list(channel, kicked_nick)

    def on_user_list(self, channel, users):
        """ ได้รับรายชื่อผู้ใช้ทั้งหมดในห้องแชทจากคำสั่ง NAMES """
        chan_key = channel.lower()
        if chan_key in self.rooms:
            # ใช้รายชื่อที่ได้รับทับค่าเดิม
            self.rooms[chan_key]["users"] = users
            self.update_user_list_ui(channel, users)

    def update_user_list_ui(self, channel, users_list):
        """ จัดเรียงลำดับสิทธิ์ผู้ใช้ และอัปเดตตัวเลขจำนวนคนแบบเรียลไทม์ถูกต้องตามความต้องการของผู้ใช้ """
        # จัดเรียงตามระดับยศ: ~ Owner, & Admin, @ Op, % HalfOp, + Voice จากนั้นผู้ใช้ธรรมดา
        def sort_key(user):
            if not user:
                return (5, "")
            
            # สกัดหาชื่อแบบคลีนเปรียบเทียบเรียงลำดับพยัญชนะ
            clean_name = self.clean_nick(user).lower()
            
            if user.startswith("~"):
                return (0, clean_name)
            elif user.startswith("&"):
                return (1, clean_name)
            elif user.startswith("@"):
                return (2, clean_name)
            elif user.startswith("%"):
                return (3, clean_name)
            elif user.startswith("+"):
                return (4, clean_name)
            else:
                return (5, clean_name)
        
        # จัดเรียงรายชื่อด้วย sort_key
        sorted_users = sorted(users_list, key=sort_key)
        
        chan_key = channel.lower()
        if chan_key in self.rooms:
            room = self.rooms[chan_key]
            room["users"] = sorted_users
            room["user_list"].clear()
            
            for u in sorted_users:
                if u:
                    room["user_list"].addItem(u)
            
            # อัปเดตรายชื่อจำนวนคนในห้องแชทลงในปุ่มแท็บ
            idx = self.tab_widget.indexOf(room["widget"])
            if idx != -1:
                self.tab_widget.setTabText(idx, f"{channel} ({len(sorted_users)})")

    def update_font_size(self):
        """ ปรับขนาดตัวอักษร 3 ระดับ: เล็ก (10px) -> กลาง (13px) -> ใหญ่ (16px) """
        sizes = [10, 13, 16]
        labels = ["เล็ก", "กลาง", "ใหญ่"]
        current_size = sizes[self.font_size_idx]
        
        # อัปเดตข้อความบนปุ่มกด
        self.font_btn.setText(f"🔍 ขนาด: {labels[self.font_size_idx]}")
        
        # ตั้งค่าฟอนต์ใหม่ทั้งหมดในหน้าต่างแสดงผล
        font = QFont("Segoe UI", current_size)
        self.status_display.setFont(font)
        self.status_display.document().setDefaultFont(font)
        self.motd_display.setFont(font)
        self.motd_display.document().setDefaultFont(font)
        
        # นำฟอนต์ไปใช้กับห้องทั้งหมด
        for r in self.rooms.values():
            r["chat_display"].setFont(font)
            r["chat_display"].document().setDefaultFont(font)
            r["user_list"].setFont(font)

    def change_font_size(self):
        """ สลับระดับขนาดตัวอักษร 3 ระดับวนซ้ำ """
        self.font_size_idx = (self.font_size_idx + 1) % 3
        self.update_font_size()

    def on_error(self, err_msg):
        """ จัดการกรณีเกิดข้อผิดพลาดขึ้นในเธรด socket """
        current_idx = self.tab_widget.currentIndex()
        current_text = self.tab_widget.tabText(current_idx)
        current_text_clean = current_text.split(" (")[0]
        
        err_html = f"<span style='color: #f87171;'><b>[ข้อผิดพลาด]</b> {err_msg}</span>"
        
        if current_text_clean.lower() in self.rooms:
            self.rooms[current_text_clean.lower()]["chat_display"].append(err_html)
        else:
            self.status_display.append(err_html)
            
        self.disconnect_irc()

    def send_message(self):
        """ ส่งข้อความแชท หรือส่งคำสั่ง """
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
                # สร้างแท็บไว้ล่วงหน้ารอข้อมูลแชทตอบกลับ
                self.get_or_create_channel_tab(args)
                self.current_channel = args
                if self.irc_worker:
                    self.irc_worker.send_line(f"JOIN {args}")
            elif cmd == "PART":
                chan = args if args else self.current_channel
                if chan:
                    if self.irc_worker:
                        self.irc_worker.send_line(f"PART {chan}")
                    self.remove_channel_tab(chan)
                    if self.current_channel == chan:
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
                # ส่ง Log คำสั่งไม่ถูกต้องไปยังหน้าจอแชทปัจจุบัน
                current_idx = self.tab_widget.currentIndex()
                current_text = self.tab_widget.tabText(current_idx)
                current_text_clean = current_text.split(" (")[0]
                
                err_msg = f"<span style='color: #f87171;'>* คำสั่ง /{cmd} ไม่รองรับในไคลเอนต์เบื้องต้นนี้</span>"
                if current_text_clean.lower() in self.rooms:
                    self.rooms[current_text_clean.lower()]["chat_display"].append(err_msg)
                elif current_text == "MOTD":
                    self.motd_display.append(err_msg)
                else:
                    self.status_display.append(err_msg)
        else:
            # ตรวจจับห้องปัจจุบันจาก แถบแท็บเพื่อส่ง PRIVMSG ไปยังปลายทางที่เลือกอยู่โดยไม่ปนกัน
            current_idx = self.tab_widget.currentIndex()
            current_text = self.tab_widget.tabText(current_idx)
            current_text_clean = current_text.split(" (")[0]
            
            if current_text in ["Status", "MOTD"] or current_text_clean.lower() not in self.rooms:
                err_msg = "<span style='color: #94a3b8;'>* กรุณาคลิกเลือกหรือเข้าร่วมห้องแชทก่อนส่งข้อความ (พิมพ์ /join #ชื่อห้องแชท)</span>"
                if current_text == "MOTD":
                    self.motd_display.append(err_msg)
                else:
                    self.status_display.append(err_msg)
                return
            
            target_chan = current_text_clean
            if self.irc_worker:
                # ส่งโปรโตคอล PRIVMSG ไปหาห้องปลายทางจริงๆ
                self.irc_worker.send_line(f"PRIVMSG {target_chan} :{text}")
                # แสดงข้อความตัวเองขึ้นหน้าจอแชทช่องที่เลือกทันที
                my_nick = self.nick_input.text()
                self.on_message_received(target_chan, my_nick, text)

    def apply_theme(self, theme):
        """ สลับการตกแต่งความสวยงามของโปรแกรมให้เป็นสไตล์ Modern UI ตามธีมมืด/สว่าง """
        self.current_theme = theme
        if theme == "dark":
            self.theme_btn.setText("☀️ Light Mode")
            self.setStyleSheet("""
                QMainWindow {
                    background-color: #0f172a;
                }
                QLabel {
                    font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', 'Arial';
                    font-size: 11px;
                    color: #94a3b8;
                    font-weight: bold;
                }
                #TopFrame {
                    background-color: #1e293b;
                    border: none;
                    border-radius: 12px;
                }
                QLineEdit {
                    background-color: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    font-family: 'Segoe UI', 'Inter', 'Arial', monospace;
                    font-size: 12px;
                    padding: 6px 10px;
                    color: #f8fafc;
                }
                QLineEdit:focus {
                    border: 1px solid #818cf8;
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
                    background-color: #1e293b;
                    border: none;
                    color: #475569;
                }
                #StatusDisplay, #MOTDDisplay, #ChatDisplay {
                    background-color: #0f172a;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                    color: #f1f5f9;
                    padding: 12px;
                }
                #UserList {
                    background-color: #1e293b;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                    color: #cbd5e1;
                    padding: 6px;
                }
                QListWidget::item {
                    padding: 5px 8px;
                    border-radius: 6px;
                    color: #cbd5e1;
                }
                QListWidget::item:hover {
                    background-color: #334155;
                    color: #ffffff;
                }
                QListWidget::item:selected {
                    background-color: #6366f1;
                    color: #ffffff;
                    font-weight: bold;
                }
                QStatusBar {
                    background-color: #0f172a;
                    border-top: none;
                    color: #94a3b8;
                    font-size: 11px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                }
                QTabWidget::pane {
                    border: none;
                    background-color: transparent;
                }
                QTabBar::tab {
                    background-color: #1e293b;
                    color: #94a3b8;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 12px;
                    margin-right: 4px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                    font-size: 11px;
                    font-weight: bold;
                }
                QTabBar::tab:selected {
                    background-color: #6366f1;
                    color: #ffffff;
                }
                QTabBar::tab:hover {
                    background-color: #334155;
                    color: #ffffff;
                }
                QSplitter::handle {
                    background-color: transparent;
                }
            """)
        else:
            self.theme_btn.setText("🌙 Dark Mode")
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
                    background-color: #94a3b8;
                    border: none;
                    color: #cbd5e1;
                }
                #StatusDisplay, #MOTDDisplay, #ChatDisplay {
                    background-color: #ffffff;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                    color: #1e293b;
                    padding: 12px;
                }
                #UserList {
                    background-color: #f1f5f9;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
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
                QTabWidget::pane {
                    border: none;
                    background-color: transparent;
                }
                QTabBar::tab {
                    background-color: #f1f5f9;
                    color: #475569;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 12px;
                    margin-right: 4px;
                    font-family: 'Segoe UI', 'Inter', 'Arial';
                    font-size: 11px;
                    font-weight: bold;
                }
                QTabBar::tab:selected {
                    background-color: #6366f1;
                    color: #ffffff;
                }
                QTabBar::tab:hover {
                    background-color: #e2e8f0;
                    color: #0f172a;
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
`;
