target_path = "/srv/trikonekt/tri-academy/frontend/src/pages/HomePage.jsx"

with open(target_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update userRankLevel and isEnrolled
old_rank = "  const userRankLevel = user?.rankLevel || 1;\n  const paidRank = getPaidRank(paidAmounts, user);"
new_rank = """  const userRankLevel = Number(user?.rankLevel || 0);
  const paidRank = getPaidRank(paidAmounts, user);
  const isEnrolled = !!(paidRank || user?.programs?.starter || userRankLevel > 0);"""

if old_rank in content:
    content = content.replace(old_rank, new_rank)
    print("Replaced userRankLevel logic")
else:
    print("WARNING: old_rank not found")

# 2. Update Active Qualified badge
old_badge = """                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Qualified
                  </span>"""

new_badge = """                  {isEnrolled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active Qualified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Admission Open (Not Enrolled)
                    </span>
                  )}"""

if old_badge in content:
    content = content.replace(old_badge, new_badge)
    print("Replaced Active Qualified badge")
else:
    print("WARNING: old_badge not found")

# 3. Update CTA button text when no paid rank
old_cta = '<span>{paidRank ? `${paidRank.rankName}${rankVideoWatched ? " · Watch 80%" : " · Watch 80%"}` : "No Paid Rank"}</span>'
# Note in the file: `${paidRank.rankName}${rankVideoWatched ? " Certified" : " · Watch 80%"}` : "No Paid Rank"}
old_cta_exact = '<span>{paidRank ? `${paidRank.rankName}${rankVideoWatched ? " Certified" : " · Watch 80%"}` : "No Paid Rank"}</span>'
new_cta = '<span>{paidRank ? `${paidRank.rankName}${rankVideoWatched ? " Certified" : " · Watch 80%"}` : "Apply for Starter (₹2,000)"}</span>'

if old_cta_exact in content:
    content = content.replace(old_cta_exact, new_cta)
    print("Replaced CTA button")
else:
    print("WARNING: old_cta_exact not found")

# 4. Update progress bar
old_prog = """                <span>{userRankLevel * 10}% Mastered (Layer {userRankLevel} of 10)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-full bg-slate-900/90 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 h-full rounded-full transition-all duration-500 shadow-md shadow-blue-500/40"
                style={{ width: `${Math.max(10, userRankLevel * 10)}%` }}
              />"""

new_prog = """                <span>
                  {userRankLevel > 0
                    ? `${userRankLevel * 10}% Mastered (Layer ${userRankLevel} of 10)`
                    : "0% Mastered (Admission Pending)"}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-full bg-slate-900/90 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 h-full rounded-full transition-all duration-500 shadow-md shadow-blue-500/40"
                style={{ width: `${userRankLevel > 0 ? Math.max(10, userRankLevel * 10) : 0}%` }}
              />"""

if old_prog in content:
    content = content.replace(old_prog, new_prog)
    print("Replaced progress bar")
else:
    print("WARNING: old_prog not found")

with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Saved HomePage.jsx successfully!")
