import React from "react";
import RankUpgrade from "../RankUpgrade";

/**
 * DigitalEducationPrime
 * - UI rename wrapper around existing RankUpgrade flow.
 * - Uses a global window flag consumed by RankUpgrade to change labels only.
 */
export default function DigitalEducationPrime() {
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

  return <RankUpgrade />;
}
