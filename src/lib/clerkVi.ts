import { viVN } from "@clerk/localizations/vi-VN";

// Fill gaps in the upstream Vietnamese locale for authentication screens.
const protectCheck = {
  loading: "Đang tải…",
  retryButton: "Thử lại",
  subtitle: "Vui lòng chờ trong khi chúng tôi xác minh yêu cầu của bạn.",
  title: "Đang xác minh yêu cầu",
};

export const clerkVi = {
  ...viVN,
  formFieldInputPlaceholder__signUpPassword: "Tạo mật khẩu",
  signIn: {
    ...viVN.signIn,
    start: {
      ...viVN.signIn?.start,
      subtitleCombined: "Đăng nhập hoặc tạo tài khoản để tiếp tục.",
    },
    emailLink: {
      ...viVN.signIn?.emailLink,
      verifiedTransferable: {
        ...viVN.signIn?.emailLink?.verifiedTransferable,
        subtitle: "Quay lại thẻ ban đầu để tiếp tục.",
        title: "Đã xác minh thư điện tử",
      },
    },
    enterpriseSSO: {
      ...viVN.signIn?.enterpriseSSO,
      formButtonPrimary: "Tiếp tục với đăng nhập một lần",
    },
    passkeyMfa: {
      ...viVN.signIn?.passkeyMfa,
      subtitle: "Dùng khóa truy cập để xác nhận danh tính. Thiết bị có thể yêu cầu vân tay, khuôn mặt hoặc mã khóa màn hình.",
      title: "Dùng khóa truy cập của bạn",
    },
    protectCheck,
    ssoBypass: {
      ...viVN.signIn?.ssoBypass,
      actionLink: "Không thể dùng đăng nhập một lần?",
      code: {
        ...viVN.signIn?.ssoBypass?.code,
        resendButton: "Chưa nhận được mã? Gửi lại",
        subtitle: "để tiếp tục đến {{applicationName}}",
        title: "Kiểm tra hộp thư của bạn",
      },
      notice: "Tổ chức yêu cầu đăng nhập một lần. Việc tiếp tục bằng cách khác sẽ được ghi nhận.",
    },
  },
  signUp: {
    ...viVN.signUp,
    protectCheck,
  },
};
