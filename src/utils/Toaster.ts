import { ReactNode } from "react";
import { toast } from "react-toastify";

const toaster = (
  status: "success" | "error" | "info" | "warning",
  message: string | ReactNode,
  duration = 3000
) => {
  toast[status](message, {
    position: "top-center",
    autoClose: duration,
    hideProgressBar: true,
    theme: "dark",
    closeButton: false,
    style: {
      textAlign: "left",
      width: "fit-content",
      top: "45px",
      backgroundColor: "#17212b",
      color: "#ffffff",
      fontSize: "15px",
      borderRadius: "10px",
      opacity: "0.95",
    },
  });
};
export default toaster;
