"# duan-fullstack"
MẮT THẦN AI - NỀN TẢNG SAAS TẠO VIDEO VÀ GIỌNG NÓI AI TOÀN DIỆN

1.MÔ TẢ DỰ ÁN (PROJECT DESCRIPTION)

Mắt Thần AI là một nền tảng phần mềm dịch vụ (SaaS) Fullstack hiện đại, cho phép người dùng khai thác sức mạnh của trí tuệ nhân tạo thế hệ mới để chuyển đổi hình ảnh thành video sống động và kiến tạo giọng nói AI đa ngôn ngữ chất lượng cao.

Hệ thống được thiết kế theo kiến trúc phi tập trung (Decoupled Architecture) tách biệt hoàn toàn giữa các phân hệ: Giao diện người dùng cuối (User App), Giao diện quản trị (Admin Panel) và Hệ thống dịch vụ lõi (Backend API Gateway). Dự án giải quyết triệt để các bài toán thực chiến của một mô hình SaaS bao gồm: quản lý tài nguyên phân tán, cơ chế sập dự phòng (fallback) API Keys, đồng bộ phiên bảo mật trên nhiều thiết bị và tích hợp cổng thanh toán tự động qua Webhook bảo mật.

Các Tính Năng Cốt Lõi:

-Xử lý Không gian làm việc (AI Video Workspace): Tải ảnh trực tiếp, tối ưu hóa dung lượng tự động qua Sharp.js, nhận diện lệnh prompt controls điều khiển mô hình sinh video thông qua tích hợp API cấp cao của Fal.ai và OpenRouter.

-Quản lý tài nguyên Giọng nói (Voice Assets Hub): Danh mục mẫu giọng nói thông minh, hỗ trợ nghe thử (preview) và xử lý văn bản thành giọng nói (Text-to-Speech) thời gian thực nhờ ElevenLabs.

-Hệ thống Xác thực Đa tầng (Advanced Authentication): Đăng nhập một chạm mượt mà qua Google OAuth 2.0 bảo mật nghiêm ngặt, cơ chế bảo vệ hai lớp (2FA) tùy biến và quản lý phiên đăng nhập (sessions) theo thiết bị/IP.

-Hệ thống Quản trị API Thiết quyền luật (Admin Key Vault): Admin toàn quyền quản lý, mã hóa lưu trữ API Keys của bên thứ ba, cấu hình hạn mức tín dụng (credits) cấp phát cho người dùng khi thực hiện tác vụ.

-Cổng thanh toán tự động (Automated Payment Gateway): Đồng bộ hóa trạng thái hóa đơn nạp credits thông qua cơ chế lắng nghe sự kiện Webhook thời gian thực từ PayOS.

2.CÔNG NGHỆ SỬ DỤNG (TECH STACK)
--------Phân hệ Backend API Server--------

+ Ngôn ngữ và Runtime: Node.js (v18+) và Express.js Framework.

+ Cơ sở dữ liệu: MySQL Database kết hợp kiến trúc Object-Relational Mapping (ORM) qua Sequelize.

+ Xác thực: Passport.js (Google Strategy), JSON Web Tokens (JWT) bảo mật Cookie 2 lớp (access_token và refresh_token).

+ Thư viện bổ trợ: Sharp.js (Nén và tối ưu ảnh), Axios (HTTP Client), Router.

-Phân hệ Giao diện (Frontend User và Admin Panel)

+ Thư viện cốt lõi: ReactJS (Functional Components và Hooks).

+ Công cụ đóng gói: Vite mang lại tốc độ biên dịch (Hot Module Replacement) tối ưu nhất.

+ Quản lý luồng dữ liệu: React Context API và Axios Interceptors tự động đính kèm và làm mới token bảo mật.

+ Giao diện và Tiện ích: Tailwind CSS / Custom CSS components đáp ứng hiển thị Responsive hoàn chỉnh trên cả Mobile và Desktop.

--------Hạ tầng và Dịch vụ tích hợp--------

+ Quản lý tiến trình Production: PM2 giữ hệ thống luôn trực tuyến (Auto-restart on crash).

+ Web Server và Reverse Proxy: Nginx cấu hình định tuyến luồng HTTPS và chống lỗi CORS.

+ AI Core Services: Fal.ai API, OpenRouter, ElevenLabs, Gemini AI.

--------CẤU TRÚC BIẾN MÔ TRƯỜNG (.ENV.EXAMPLE)--------

Dự án sử dụng 3 file .env độc lập cho từng phân hệ để đảm bảo tính đóng gói mã nguồn:

3.1 Backend Configuration (duAn_Fullstack_Backend/.env)
PORT=3000
NODE_ENV=development

CONFIGURATION DATABASE (MYSQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=duan_fullstack
DB_USER=root
DB_PASSWORD=your_mysql_password_here

AUTHENTICATION VÀ SECURITY
JWT_ACCESS_SECRET=your_super_secret_access_key_123
JWT_REFRESH_SECRET=your_super_secret_refresh_key_456

GOOGLE OAUTH 2.0 CREDENTIALS
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_key
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

PRODUCTION DOMAIN ROUTING
FRONTEND_URL=http://localhost:5173
ADMIN_FRONTEND_URL=http://localhost:5174

3.2 Frontend User Configuration (duAn_Fullstack_Frontend/.env)
VITE_API_URL=http://localhost:3000/api

3.3 Admin Panel Configuration (duan_Fullstack_Admin/.env)
VITE_API_URL=http://localhost:3000/api

--------HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY (LOCAL SETUP)--------

Bước 1: Chuẩn bị Cơ sở dữ liệu

Mở công cụ quản lý cơ sở dữ liệu của bạn (Navicat, MySQL Workbench, v.v.).

Tạo một database mới tên là duan_fullstack.

Khởi chạy mã nguồn các bảng cơ sở dữ liệu tương ứng của dự án (hoặc chạy Migration nếu có).

Bước 2: Cài đặt và Chạy Backend Server
cd duAn_Fullstack_Backend
npm install
Lập cấu hình file .env dựa trên mẫu .env.example và điền thông số của bạn
npm start
Backend hoạt động tại địa chỉ: http://localhost:3000

Bước 3: Cài đặt và Chạy Frontend User App
cd ../duAn_Fullstack_Frontend
npm install
Kiểm tra file .env đảm bảo trỏ đúng cổng Backend 3000
npm run dev
Giao diện người dùng cuối hoạt động tại: http://localhost:5173

Bước 4: Cài đặt và Chạy Admin Panel App
cd ../duan_Fullstack_Admin
npm install
Kiểm tra file .env đảm bảo trỏ đúng cổng Backend 3000
npm run dev
Giao diện quản trị viên hoạt động tại: http://localhost:5174

--------HỆ THỐNG TÀI KHOẢN DEMO (DEMO ACCOUNTS)--------

-Để thuận tiện cho quá trình kiểm thử và đánh giá hệ thống, bạn có thể sử dụng các tài khoản kiểm thử được phân quyền sẵn dưới đây:

+ Phân hệ truy cập:

Tài khoản đăng nhập (Email): :alice@example.com

Mật khẩu (Password): Tranbac2003@

Quyền hạn (Role): user

-Chức năng thử nghiệm chính: Trải nghiệm Workspace tạo Video AI, Quản lý credits và xem lịch sử tác vụ, Đăng nhập nhanh qua nút Google Auth.

Phân hệ truy cập: Hệ thống Quản trị (http://localhost:5174)

Tài khoản đăng nhập (Email): admin@system.com

Mật khẩu (Password): Tranbac2003@

Quyền hạn (Role): admin

Chức năng thử nghiệm chính: Cấu hình mã hóa API Keys hệ thống, Cấp phát hoặc Thu hồi credits người dùng, Kiểm tra Log giám sát hệ thống.

--------CHI TIẾT CÁC TÍNH NĂNG THỰC CHIẾN (DETAILED FEATURES)--------

Dự án được phân tách thành các luồng nghiệp vụ khép kín nhằm tối ưu hóa trải nghiệm người dùng cuối và cung cấp bộ công cụ quản trị tuyệt đối cho Admin.

--------PHÂN HỆ NGƯỜI DÙNG CUỐI (USER APPLICATION)--------

Luồng Xác Thực Bảo Mật và Quản Lý Phiên (Advanced Auth và Sessions)

Đăng nhập một chạm (Google OAuth 2.0): Tích hợp an toàn với Google Cloud Console. Hệ thống tự động bóc tách thông tin cá nhân (Email, Avatar, Tên hiển thị) để khởi tạo tài khoản hệ thống mà không cần mật khẩu.

Xác thực truyền thống (JWT Dual-Token): Cơ chế mã hóa mật khẩu bằng bcrypt. Hệ thống cấp phát cặp mã thông báo: access_token (sống ngắn hạn, lưu trong bộ nhớ tạm) và refresh_token (sống dài hạn, cấu hình Cookie bảo mật HttpOnly, Secure, SameSite).

Quản lý phiên đăng nhập (sessions table): Ghi vết chi tiết từng thiết bị, trình duyệt và địa chỉ IP của người dùng. Cho phép người dùng kiểm soát và đăng xuất từ xa khỏi các thiết bị lạ để chống rò rỉ tài khoản.

Không Gian Làm Việc Tạo Video AI (AI Video Workspace)

Tối ưu hóa hình ảnh đầu vào (Image Processing Pipeline): Tích hợp thư viện Sharp.js xử lý ngầm tại Backend. Khi user upload ảnh gốc (dung lượng lớn), hệ thống tự động nén, căn chỉnh kích thước (resize) để giảm tải băng thông và tối ưu chi phí tính toán khi gửi lên AI API.

Lệnh điều khiển thông minh (Prompt Controls): Giao diện cho phép nhập mô tả chuyển động nâng cao. Hệ thống tự động chuẩn hóa chuỗi và chuyển tiếp tới các siêu mô hình thông qua API Gateway của Fal.ai và OpenRouter.

Cơ chế Polling giám sát trạng thái (State Machine): Tác vụ tạo video chạy ngầm (Asynchronous Task). Hệ thống quản lý chặt chẽ trạng thái vòng đời tác vụ thông qua các trạng thái: pending (chờ xử lý) -> processing (đang xử lý) -> completed (hoàn thành) hoặc failed (thất bại), tự động cập nhật giao diện thời gian thực mà không cần reload trang.

Trung Tâm Quản Lý Giọng Nói AI (Voice Assets Hub)

Danh mục mẫu giọng nói phong phú: Hỗ trợ đa ngôn ngữ (Tiếng Việt, Tiếng Anh, Tiếng Nhật,...) với bộ lọc giới tính và tone giọng linh hoạt.

Nghe thử thời gian thực (Audio Preview): Người dùng có thể nghe thử các đoạn audio ngắn của từng mẫu giọng trực tiếp trên giao diện trước khi quyết định sử dụng.

Chuyển đổi văn bản thành giọng nói (Text-to-Speech): Kết nối trực tiếp với API của ElevenLabs, chuyển đổi văn bản dài thành file âm thanh chất lượng cao, tự động lưu trữ và quản lý lịch sử tải về của người dùng.

Nạp Credits Tự Động và Tích Hợp Cổng Thanh Toán (Billing và PayOS Webhook)

Mô hình kinh doanh SaaS dựa trên Tín dụng (Credit-Based): Mỗi lượt tạo video hoặc sinh giọng nói AI sẽ khấu trừ một lượng credits tương ứng trong ví người dùng dựa trên độ phức tạp của tác vụ.

Tạo hóa đơn bằng Mã QR chuyển khoản tự động: Tích hợp sâu với cổng PayOS. Khi chọn gói nạp, hệ thống sinh mã QR động chứa chính xác số tiền, nội dung chuyển khoản và thời gian hết hạn hóa đơn.

Xử lý sự kiện Webhook thời gian thực: Backend cấu hình một Endpoint bảo mật để lắng nghe tín hiệu thanh toán thành công từ ngân hàng (thông qua PayOS). Ngay khi tiền vào tài khoản, Webhook tự động kích hoạt lệnh cộng credits cho người dùng ngay lập tức (Zero-Delay) kèm thông báo đẩy (notifications).

--------PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN PANEL)--------

Két Sắt Quản Lý API Keys (Admin Key Vault và Fallback Mechanism)

Mã hóa và Lưu trữ tập trung: Admin quản lý toàn bộ API Keys của các nhà cung cấp (OpenAI, ElevenLabs, Gemini, Fal.ai) tập trung trong Database. Tất cả các key đều được mã hóa trước khi lưu để chống rò rỉ dữ liệu.

Cơ chế tự động chuyển vùng dự phòng (Fallback Mechanism): Nếu một API Key của nhà cung cấp A bị hết tiền hoặc lỗi hạn mức (Rate Limit), Backend sẽ tự động phát hiện và chuyển đổi sang Key dự phòng B hoặc mô hình thay thế (ví dụ từ Fal.ai chuyển sang OpenRouter) để đảm bảo hệ thống của khách hàng không bị gián đoạn.

Quản Lý Người Dùng và Điều Phối Hạn Mức (User và Credit Management)

Giám sát toàn diện: Xem danh sách toàn bộ khách hàng, trạng thái hoạt động, lịch sử tạo video và số dư tín dụng hiện tại của họ.

Can thiệp số dư trực tiếp: Admin có quyền cộng/trừ credits thủ công cho người dùng trong các trường hợp đặc biệt (bồi hoàn lỗi hệ thống, tặng quà sự kiện, v.v.). Toàn bộ hành động can thiệp này đều được lưu vào log hệ thống để phục vụ đối soát.

-------- ĐIỂM SÁNG VỀ KIẾN TRÚC KỸ THUẬT (TECHNICAL HIGHLIGHTS)--------

Axios Interceptors (Cơ chế tự động vá lỗi 401): Hệ thống Frontend cấu hình bộ đánh chặn Axios thông minh. Khi một request gửi đi nhận về lỗi 401 Unauthorized (Token hết hạn), Interceptor sẽ tự động giữ request đó lại, âm thầm gọi API làm mới token (refresh_token), cập nhật token mới rồi gửi lại request ban đầu. Người dùng hoàn toàn không nhận ra và không bị gián đoạn trải nghiệm.

Nginx Reverse Proxy và Bảo mật SSL: Toàn bộ hệ thống chạy trên môi trường mã hóa HTTPS (SSL Certbot). Nginx đóng vai trò làm lá chắn điều phối luồng: Cổng 80/443 của domain chính trỏ về thư mục tĩnh Frontend, Subdomain api.matthanai.cloud chuyển tiếp an toàn (Reverse Proxy) vào cổng 3000 của Node.js Backend chạy ngầm.

Quản trị bất tử tiến trình bằng PM2: Phân hệ Backend được giám sát chặt chẽ bởi PM2. Đảm bảo nếu có lỗi bất ngờ xảy ra gây sập luồng (Crash), hệ thống sẽ tự động hồi sinh (Auto-restart) trong mili-giây, duy trì trạng thái Online 24/7.