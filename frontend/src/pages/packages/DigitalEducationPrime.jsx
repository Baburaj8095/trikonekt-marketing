import React from "react";
import { useLocation } from "react-router-dom";
import RankUpgrade from "../RankUpgrade";

/**
 * DigitalEducationPrime
 * - UI rename wrapper around existing RankUpgrade flow.
 * - Uses a global window flag consumed by RankUpgrade to change labels only.
 */
export default function DigitalEducationPrime() {
  const location = useLocation();
  const defaultToRankId = React.useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const raw = params.get("rank_id");
    return raw ? Number(raw) : null;
  }, [location.search]);

  React.useEffect(() => {
    try {
      window.__tk_rank_upgrade_label_override = {
        title: "Digital Education Prime",
        rankWord: "Digital Education Prime",
      };
    } catch (_) {}
    return () => {
      try {
        delete window.__tk_rank_upgrade_label_override;
      } catch (_) {}
    };
  }, []);

  return <RankUpgrade defaultToRankId={defaultToRankId} />;
}
