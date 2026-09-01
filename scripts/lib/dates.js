// 本地日历日工具（零依赖）。
// 语义约定：SkillHub 的"日期"一律是服务器本地日历日（生产主机 = Asia/Shanghai）。
// 严禁用 toISOString().slice(0,10)（UTC 日历日）：本地 00:00–07:59 会被记成前一天，
// 曾导致 daily/promo "当日已跑"记账与比较错位、同一天重复触发模型管线。
function localDate(now) {
  const d = now || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

module.exports = { localDate };
