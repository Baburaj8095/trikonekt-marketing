import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const navigate = useNavigate();
  useEffect(() => {
    // Coupons module removed. Redirect to Lucky Draw.
    navigate("/user/lucky-draw", { replace: true });
  }, [navigate]);
  return null;
}
