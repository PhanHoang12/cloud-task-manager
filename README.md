# Cloud Task Management System — hướng dẫn triển khai

Dự án React + Vite + TypeScript, Convex (database/backend), Clerk (authentication), Vercel (hosting). Có 5 mutations/queries, đăng nhập, CRUD, 3 trạng thái, mức ưu tiên, hạn hoàn thành, tìm kiếm, thống kê và realtime.

## 0. Yêu cầu

- Node.js LTS, Git, VS Code; tài khoản Convex, Clerk, GitHub, Vercel.
- Lệnh chạy ở PowerShell trong thư mục dự án.

## 1. Cài đặt

```powershell
npm install
```

## 2. Tạo Convex development deployment

```powershell
npx convex dev --once
```

Đăng nhập/tạo project theo hướng dẫn CLI. Tệp `.env.local` được tạo và chứa `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`.

## 3. Cấu hình Clerk

1. Vào https://dashboard.clerk.com, tạo application, bật email sign-in.
2. Vào **Convex integration** của Clerk, chọn Activate, lấy **Frontend API URL** (ví dụ `https://abc.clerk.accounts.dev`). Lưu ý cần lấy domain được giao diện trả về, không dùng URL ví dụ.
3. Vào **API keys** lấy **Publishable key** và thêm dòng sau vào `.env.local`:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_REAL_VALUE
```

4. Set URL issuer của Clerk trong **môi trường Convex dev**, không phải trong file `.env.local`:

```powershell
npx convex env set CLERK_FRONTEND_API_URL "https://YOUR-CLERK-FRONTEND-API-URL"
```

5. Đồng bộ `convex/auth.config.ts`, schema, functions và sinh code generated:

```powershell
npx convex dev --once
```

Nếu báo lỗi auth, xem Clerk Convex integration và đúng Frontend API URL.

## 4. Chạy local

Terminal A:

```powershell
npx convex dev
```

Terminal B:

```powershell
npm run dev
```

Truy cập URL của Vite (thường là http://localhost:5173). Tạo 2 tài khoản riêng; xác thực cả 2, kiểm tra dữ liệu không bị lộ giữa các tài khoản.

## 5. Test build

```powershell
npm run build
```

Nếu lỗi `convex/_generated/api`, hãy chạy `npx convex dev --once` trước. `convex/_generated` nên được commit để CI typecheck.

## 6. Push GitHub

```powershell
git init
git add .
git commit -m "Build Cloud Task Management System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Không commit `.env.local` hay Deploy Key. Thay URL GitHub ví dụ bằng repo đã tạo.

## 7. Clerk production

1. Trong Clerk, tạo/chuyển **Production instance**. Theo hướng dẫn của Clerk, cấu hình domain, authorized origins/redirects cần thiết cho domain Vercel. Nếu Clerk yêu cầu tên miền riêng/thiết lập DNS, phải hoàn tất theo yêu cầu trước khi thử đăng nhập production.
2. Lấy **Production Publishable Key** và **Production Frontend API URL** của đúng production instance (thường dạng `https://clerk.yourdomain.com`). Development key `pk_test_...` không nên dùng làm production.

## 8. Convex production

1. Trong Convex Dashboard, chọn **Production deployment** của project.
2. Vào Settings -> Environment Variables; đặt `CLERK_FRONTEND_API_URL` thành Production Frontend API URL từ bước 7. Có thể dùng `npx convex env --prod set CLERK_FRONTEND_API_URL "https://..."`.
3. Vào Deployment Settings / General, tạo **Production Deploy Key** có quyền `deployment:deploy`.

## 9. Vercel

1. Truy cập https://vercel.com/new, chọn GitHub repo.
2. Framework Preset: Vite. Root Directory: `/`.
3. Build Command override:

```bash
npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

4. Project Settings -> Environment Variables (Production):
   - `CONVEX_DEPLOY_KEY`: production deploy key từ Convex; chỉ cấu hình Production.
   - `VITE_CLERK_PUBLISHABLE_KEY`: production publishable key từ Clerk.
   - `VITE_CONVEX_URL`: không cần đặt thủ công nếu dùng build command phía trên. Convex CLI cấp URL production trong lúc build.
5. Deploy. Truy cập domain của Vercel, kiểm tra đăng ký/đăng nhập và CRUD. Nếu Clerk bắt buộc cấu hình domain/redirect URLs, thêm URL Vercel thực tế vào Clerk.

### Development khác Production

Convex dev và prod có database riêng. Cấu hình `CLERK_FRONTEND_API_URL` ở **cả hai** môi trường, tương ứng Clerk development và production. Production cũng cần schema/backend deployment, thực hiện qua Vercel build ở bước trên.

## 10. Kiểm thử bảo mật

- Chưa đăng nhập: không đọc được danh sách hay tạo việc.
- Tài khoản A tạo việc: tài khoản B không thấy việc của A.
- Tài khoản B không được phép cập nhật/xóa task ID của A: backend kiểm tra `ownerId`.
- Refresh trình duyệt: dữ liệu vẫn còn.
- Hai tab cùng tài khoản: cập nhật realtime.
- Kiểm tra `Console` (F12), Deploy logs Vercel, Logs Convex nếu xảy ra lỗi.

## Danh sách functions

- `tasks.list` — query xem task của tài khoản đang đăng nhập.
- `tasks.create` — mutation thêm task.
- `tasks.update` — mutation chỉnh sửa.
- `tasks.setStatus` — mutation đổi trạng thái.
- `tasks.remove` — mutation xóa task.

## Vấn đề thường gặp

- Missing `VITE_CONVEX_URL`: chạy `npx convex dev --once`.
- Missing `VITE_CLERK_PUBLISHABLE_KEY`: nhập key đúng vào `.env.local`.
- `Not authenticated`: kiểm tra Clerk Convex integration, URL issuer và `convex/auth.config.ts`; restart `npx convex dev`.
- Frontend build pass nhưng login prod fail: xem Clerk production domain / Production Frontend API URL; không dùng URL development cho production.
- Deploy thiếu key: `CONVEX_DEPLOY_KEY` phải là production deploy key, chỉ đặt server-side ở Vercel.

## Nguồn chính thức

- https://docs.convex.dev/auth/clerk
- https://clerk.com/docs/guides/development/integrations/databases/convex
- https://docs.convex.dev/production/hosting/vercel
- https://docs.convex.dev/client/react/deployment-urls
