// What each phase asks of the players, round by round (rulebook p.8–11, solo p.23).
// phaseInfo(k, round, rounds, n, opt) → { html: explanation, tag: short note on the phase row, skip: why it is skipped this round }
// opt: { nor: Norwegians expansion (its rulebook p.3–6), passOrder: pass-order turn order variant }
import { EXPLORE_ROUNDS, EXPLORE_TURNS } from './logic.js';

// Harvest mark under each round of the Banquet Table: 0 = no harvest, 1–4 = crops 1 to n.
// Long game: rulebook p.8. Short game: not printed in the rulebook, read from photos of the short side of the home board.
export const HARVEST = { 7: [1, 2, 0, 3, 0, 4, 0], 6: [1, 0, 2, 0, 3, 0] };
const CROPS = ['豌豆、豆子、亚麻', '谷物', '卷心菜', '水果'];   // level 1 gives the first three, each level adds one more

function harvest(r, R) {
  const lv = HARVEST[R][r - 1];
  const check = R === 6 ? '<p class="tip">快速模式的收获以部落版图上该轮的标记为准。</p>' : '';
  if (lv === 0) return { tag: '本轮无收获', html: `<p>本轮<b>无收获</b>，什么也不拿。</p>${check}` };
  const got = CROPS.slice(0, lv).join('、');
  return { tag: got, html: `<p>每人从供应区各拿 1 个：<b>${got}</b>（橙色农产品），放进自己的供应区。</p>${check}` };
}

export function phaseInfo(k, r, R, n, opt = {}) {
  const lastRound = r === R, solo = n === 1, nor = !!opt.nor, po = !!opt.passOrder;
  switch (k) {
    case 1: return { tag: '每人 +1 维京人', html: '<p>每人从部落版图「宴会桌」最左边拿走维京人，放到庭之广场。空出来的格子就是当前轮数。</p>' };
    case 2: return harvest(r, R);
    case 3: {
      const i = EXPLORE_ROUNDS[R].indexOf(r);
      if (i < 0) return { skip: r === 1 || lastRound ? '第 1 轮和最后一轮没有此阶段' : '本轮不翻板' };
      if (nor) return { tag: `翻字母 ${'ABCD'[i]} 的版图`, html: `<ul><li>所有还没被拿走、正面字母为 <b>${'ABCD'[i]}</b> 的探索版图一起翻面（挪威扩展桌上可能有好几块同字母的版图）。</li>
        <li>其余<b>没被拿走</b>、本轮也不翻的探索版图各放 <b>2 银币</b>；被翻面的版图上原有的银币退回供应区。</li></ul>${solo ? '<p class="tip">单人：熟悉后可以跳过这个阶段。</p>' : ''}` };
      const [from, to] = EXPLORE_TURNS[i].split(' → ');
      return { tag: EXPLORE_TURNS[i], html: `<ul><li>把探索版图<b>${from}</b>翻面，换成<b>${to}</b>；已被玩家拿走的就不翻。</li>
        <li>其余<b>没被拿走</b>的探索版图各放 <b>2 银币</b>；被翻面的版图上原有的银币退回供应区。</li></ul>${solo ? '<p class="tip">单人：熟悉后可以跳过这个阶段。</p>' : ''}` };
    }
    case 4: return { tag: '每人 1 张', html: '<p>每人从武器牌堆抽 1 张武器卡牌，正面朝上放在自己面前。牌堆抽完时，把弃牌洗成新牌堆。</p>' };
    case 5: return { tag: solo ? '' : '从起始玩家起顺时针', html: `<ul>
        <li>${solo ? '你' : '从起始玩家开始顺时针轮流，每次'}把维京人放到<b>一个</b>空的行动格上，并立刻执行。</li>
        <li>行动版图第 1 / 2 / 3 / 4 列的行动格，分别需要 1 / 2 / 3 / 4 个维京人；每格每轮只能被占一次。</li>
        <li>可以随时停手（停手后本轮不能再放），维京人用完必须停。所有人都停手，本阶段结束。</li></ul>
        ${nor ? `<p class="tip">挪威扩展：第 5 列放 1 或 2 个维京人，必须是你本轮最后一次放置（放完就停手）。${n === 4 ? '四人局不再有模仿格。' : ''}</p>` : ''}
        ${solo ? '<p class="tip">单人：上一轮放的维京人留在行动版图上，挡住那些行动格。</p>' : lastRound ? '' : po ? '<p class="tip">停手顺序轮序：每有一位玩家停手，就在下面按顺序点他一下。</p>' : '<p class="tip">留意谁是<b>最后一个</b>放维京人的：他下一轮当起始玩家。</p>'}` };
    case 6:
      if (solo) return { skip: '单人游戏跳过' };
      if (lastRound) return { skip: '最后一轮不需要' };
      if (po) return { tag: '按停手顺序自动排好', html: '<p>最后停手（最后放置维京人）的玩家拿起始玩家指示物（驼鹿）；其余玩家按停手先后<b>倒过来</b>排：越早停手，下一轮越晚行动。下一轮顺序：</p>' };
      return { tag: '最后放维京人的玩家', html: '<p>行动阶段<b>最后放置维京人</b>的玩家拿起始玩家指示物（驼鹿），下一轮第一个行动。点下面选出这位玩家：</p>' };
    case 7: return { tag: '领银币', html: `<p>部落版图「收入斜线」上<b>最小的未被盖住的数字</b>，就是你本轮领的银币数；已拿到的探索版图如有收入，同样领取。</p>
        ${lastRound ? '<p class="tip">最后一轮：也可以不领银币，改把收入记到计分表「最终收入」一栏。</p>' : ''}` };
    case 8: if (nor) return { tag: '羊、牛、马、猪分开算', html: `<ul><li>羊、牛、马：有<b>怀孕</b>的，全部翻回不怀孕，再得 1 只新的；没有怀孕的、但至少 <b>2 只</b>，把其中 1 只翻成怀孕。</li>
        <li>猪：没有怀孕面，只要有 <b>2 只以上</b>，每轮都再得 1 只。</li>
        <li>已经放到版图或建筑上的动物不繁殖。</li></ul>` };
      return { tag: '羊、牛分开算', html: `<ul><li>有<b>怀孕</b>的：全部翻回不怀孕，再从供应区得 1 只新的。</li>
        <li>没有怀孕的、但至少有 <b>2 只</b>：把其中 1 只翻成怀孕。</li></ul><p class="tip">所以羊和牛每两轮生一次。</p>` };
    case 9: return { tag: '', html: `<ul><li>宴会桌上<b>没被维京人和移民船占住</b>的格子都要摆满：橙色农产品、红色畜产品，或「1 银币」。</li>
        <li>橙色不能挨橙色，红色不能挨红色；银币可以相邻；铁矿不能上桌。</li>
        <li>同一种食物最多 1 块横放，其余同种只能竖放；每块都要压住桌下的格子，不能超出。</li>
        <li>每个没摆东西的格子，拿 1 个<b>庭之惩罚</b>（终局每个 −3）。宴会后桌上的东西退回供应区。</li></ul>
        ${lastRound ? '<p class="tip">最后一轮：宴会结束，游戏立即结束，进入终局计分。</p>' : ''}` };
    case 10:
      if (lastRound) return { skip: '最后一轮没有奖励' };
      return { tag: '物品格奖励', html: '<p>部落版图上的物品格如果自身没被盖住、而周围的格子全被盖住（周围 8 格，靠边的 5 格），每轮都给你这个物品。所有奖励同时领取。</p>' };
    case 11:
      if (lastRound) return { skip: '最后一轮没有此阶段' };
      return { tag: '移走 · 再翻一块', html: `<ul><li>每块翻开的山脉板块，移走<b>最左边</b>（离箭头最近）的 1 项；最后的「2 银币」也算 1 项，板块空了就移出游戏。</li>
        <li>然后再翻开 1 块新山脉板块，放上图示资源。${n === 4 && R === 7 && r === 6 ? '<b>四人标准模式到这一轮山脉板块已经用完，不再翻新的。</b>' : '山脉板块用完就不再添加。'}</li></ul>` };
    case 12:
      if (lastRound) return { skip: '最后一轮没有此阶段' };
      return { tag: '', html: solo
        ? '<p>单人：第 1 轮结束时<b>不取回</b>，把等待区另一种颜色的维京人移到庭之广场；之后每轮只取回<b>上一轮</b>放的维京人，本轮放的留在行动版图上。</p>'
        : `<p>把行动版图上的维京人取回各自的庭之广场，然后进入第 ${r + 1} 轮。</p>` };
  }
  return { html: '' };
}
