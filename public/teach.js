// 3-minute teach: a script the teacher reads aloud to start a first game, written from the official rulebook
// (same wording as tools/讲解稿.md). It names every important element in a sentence and leaves the fine rulings to the
// rules assistant. Terms in {text|id} open a note with a picture cropped from the rulebook (img/teach/<icon>.webp); the
// 「问」 buttons and each note's 「问规则助手」 ask the rules assistant (chat.js) straight away.
// Two modes, chosen at the top and remembered: with the Norwegians (default, how most groups play) or base game only.
// A line, question or note is for both, or {b} base only / {n} Norwegians only. After the script, 注意事项 (NOTES) lists
// the easy-to-get-wrong points. Pictures: official rulebooks (user's call: Z-Man base, Feuerland Die Norweger), credited in the footer.
const ICON = (id, cls = '') => id ? `<img class="ico ${cls}" src="img/teach/${id}.webp" alt="">` : '';

// id: name, where you see it on the table, what it means. icon: a picture in img/teach/.
const TERMS = {
  homeboard: { name: '部落版图', icon: 'homeboard', where: '每人面前那块大版图：左边是摆放区，右上是宴会桌，右下是码头和畜栏。', what: '你的家业。摆放区满是负分格，要用物品板块盖住；盖得越多收入越高，终局没盖住的每格扣 1 分。' },
  minus: { name: '负分格', icon: 'minus', where: '部落版图、探索版图和房屋上印着 −1 的格子。', what: '终局时每个没盖住的负分格扣 1 分。盖住它们是这个游戏最主要的目标。' },
  shield: { name: '盾牌分值', icon: 'shield', where: '船、探索版图、房屋、职业卡等上面的盾牌图标。', what: '盾牌里的数字就是这样东西终局值多少分。' },
  viking: { name: '维京人', icon: 'viking', where: '你颜色的小人：开局一部分站在宴会桌的数字格上，其余在庭之广场。', what: '你的工人。每轮开始从宴会桌最左边多拿 1 个，放到行动版图上执行行动，轮末再收回来。' },
  moose: { name: '起始玩家驼鹿', icon: 'moose', where: '一个驼鹿形状的木块。', what: '拿着它的人每轮第一个放维京人。行动阶段最后一个放维京人的人，下一轮拿到它。' },
  silver: { name: '银币', icon: 'silver', where: '硬币，面值 1、2、4、10。', what: '买船、移民、付费行动都用它；宴会上可以当一格食物；也能当填空格的板块。终局手边每 1 银算 1 分，放在版图上的不算。' },
  wood: { name: '木头', icon: 'wood', where: '木制方块：山脉板块上、供应区。', what: '造船、造工棚、打猎时付的材料。' },
  stone: { name: '石头', icon: 'stone', where: '灰色木块：山脉板块上、供应区。', what: '造石屋、长屋的材料；突袭时每花 1 块石头点数加 1。' },
  ore: { name: '铁矿', icon: 'ore', where: '黑色小块：山脉板块上、供应区。', what: '放到捕鲸船和长船上让它们更强；也能当填空格的板块（铁矿可以挨着铁矿）。不能上宴会桌。' },
  mountain: { name: '山脉板块', icon: 'mountain', where: '行动版图旁边一条条长板块，上面摆着木头、石头、铁矿和银币。', what: '「山脉」行动从这里按从左到右拿资源。每轮结束最左边那项被移走，再翻一块新的。' },
  orange: { name: '橙色农产品', icon: 'orange', where: '橙色的物品板块，比如豌豆、豆子、亚麻、谷物。', what: '收获时拿到，宴会上当食物。不能摆进部落版图的摆放区。' },
  red: { name: '红色畜产品', icon: 'red', where: '红色的物品板块，比如蜂蜜酒、鱼干、牛奶、腌肉；牛羊也算。', what: '宴会上当食物。红色不能挨红色上桌。' },
  green: { name: '绿色手工品', icon: 'green', where: '绿色的物品板块，比如油、兽皮、羊毛、亚麻布。', what: '能摆进部落版图盖负分格，但绿色不能和绿色上下左右挨着。' },
  blue: { name: '蓝色奢侈品', icon: 'blue', where: '蓝色的物品板块，比如符文石、银器、宝箱、丝绸；特殊板块也算蓝色。', what: '最值钱的物品：能摆进部落版图，蓝色之间可以随便挨着，是盖满版图的主力。' },
  upgrade: { name: '升级物品', icon: 'upgrade', where: '交易类行动格上的向上箭头。', what: '把物品换成同样形状、更值钱的一级：橙变红、红变绿、绿变蓝。' },
  placement: { name: '摆放区', icon: 'placement', where: '部落版图左边那片格子，以及探索版图上的格子。', what: '随时可以把绿色、蓝色物品、银币和铁矿摆进去盖格子，摆了就拿不回来。绿色不能和绿色上下左右相邻。石屋、长屋里另有规定，还能放食物。' },
  incomediag: { name: '收入斜线', icon: 'incomediag', where: '部落版图摆放区里斜着排的一串大数字。', what: '每轮收入阶段，按最小的没被盖住的数字领银币。要按从小到大的顺序盖。' },
  bonus: { name: '奖励物品格', icon: 'bonus', where: '部落版图摆放区里印着物品图案的格子。', what: '它自己留着不盖、把它四周全盖住，每轮奖励阶段就送你一个这种物品。' },
  banquet: { name: '宴会桌', icon: 'banquet', where: '部落版图右上角那排格子，开局上面站着维京人。', what: '维京人每轮离开一个，空出的格子在宴会阶段都要摆食物：橙色、红色或 1 银币，橙挨橙、红挨红都不行。' },
  harvest: { name: '收获标记', icon: 'harvest', where: '宴会桌每个数字格下方的小图示。', what: '这一轮收获阶段每人能拿哪些橙色农产品；有的轮次没有收获。' },
  thing: { name: '庭之惩罚', icon: 'thing', where: '惩罚板块，拿了放在自己面前。', what: '宴会桌每空一格拿一个，终局每个扣 3 分。' },
  sheep: { name: '羊', icon: 'sheep', where: '羊的板块，养在部落版图右下的畜栏里。', what: '每两轮生一只；可以当食物、换东西；终局每只 2 分，怀孕的 3 分。' },
  cattle: { name: '牛', icon: 'cattle', where: '牛的板块，养在畜栏里。', what: '和羊一样每两轮生一只；终局每头 3 分，怀孕的 4 分。' },
  pregnant: { name: '怀孕', icon: 'pregnant', where: '动物板块的背面。', what: '有 2 只以上同种动物时，繁殖阶段把 1 只翻成怀孕；下一次繁殖它就生 1 只新的。' },
  whaler: { name: '捕鲸船', icon: 'whaler', where: '小船板块，停在部落版图码头的小泊位，最多 3 艘。', what: '3 银或造船行动建造。用来捕鲸，也能去近处的岛探索。终局 3 分。' },
  knarr: { name: '商船', icon: 'knarr', where: '中号船板块，停在码头的大泊位。', what: '5 银或造船行动建造。用来海外交易（把绿色物品翻成蓝色）、买特殊板块、探索和移民。终局 5 分。' },
  longship: { name: '长船', icon: 'longship', where: '大号船板块，停在码头的大泊位（大船最多 4 艘）。', what: '8 银或造船行动建造。用来突袭、抢劫、远航探索和移民。终局 8 分。' },
  dice: { name: '骰子', icon: 'dice', where: '橙色 8 面骰和蓝色 12 面骰。', what: '突袭、抢劫掷大，狩猎、设陷阱、捕鲸掷小。最多掷 3 次，可以花武器卡等调整结果，失败也有安慰奖。' },
  weapon: { name: '武器卡', icon: 'weapon', where: '红色卡背的卡：弓箭、陷阱、长矛、长剑。', what: '每轮抽 1 张。掷骰的行动用它来调整结果，比如突袭时每把长剑点数加 1。' },
  special: { name: '特殊板块', icon: 'special', where: '椭圆供应板上的一堆独特板块。', what: '算蓝色物品，突袭或抢劫掷得够大就能拿，用商船的行动也能买。' },
  crown: { name: '英格兰王冠', icon: 'crown', where: '特殊板块里剑值最高的那块。', what: '不能买，突袭或抢劫掷得够大才拿得到。终局额外 2 分，放在哪儿都算。' },
  explore: { name: '探索版图', icon: 'explore', where: '桌边四块双面岛屿版图，中途会翻面换成更远的岛。', what: '用船和维京人拿下来，接在部落版图旁：多一块摆放区和不少分，有的还有收入，但也带来新的负分格。' },
  emigrate: { name: '移民', icon: 'emigrate', where: '把船翻面放到宴会桌上。', what: '付当前轮数的银币，把一艘商船或长船翻面放上宴会桌：以后宴会少摆几格，终局商船 18 分、长船 21 分。' },
  shed: { name: '工棚', icon: 'shed', where: '小房子板块，接在部落版图旁。', what: '8 分，带几个负分格，只能用木头和石头填；通常留到终局，把剩下的木头、石头放上去。' },
  stonehouse: { name: '石屋', icon: 'stonehouse', where: '中号房子板块。', what: '10 分，带负分格；里面能放食物、手工品、奢侈品和银币。' },
  longhouse: { name: '长屋', icon: 'longhouse', where: '大号房子板块。', what: '17 分，负分格最多；里面能放的东西和石屋一样，中间两根柱子不能盖。' },
  occupation: { name: '职业卡', icon: 'occupation', where: '棕色卡背的卡，开局手里 1 张。', what: '用行动打出才生效，每张有一个特殊能力；终局按右上角计分。第 3 列放满先抽 1 张，第 4 列放满多打 1 张。' },
  actionboard: { name: '行动版图', icon: 'actionboard', where: '桌子中间最大的那块版图。', what: '每个格子是一种行动，每格每轮只能被占一次。左侧写着行动类别，从左到右分 4 列。' },
  columns: { name: '行动列', icon: 'columns', where: '行动版图从左到右的 4 列。', what: '第 1、2、3、4 列的格子分别要放 1、2、3、4 个维京人。越往右越强，也越贵。' },
  // the Norwegians (pictures from the Feuerland rulebook Die Norweger)
  nwboard: { name: '扩展行动版图', icon: 'nwboard', where: '三块双面的行动版图，竖着拼在桌子中间，按人数选用哪一面。', what: '取代基础游戏的大行动版图。规则不变：每格每轮只能占一次，第 1 到 4 列分别放 1 到 4 个维京人，另外多了第 5 列。基础四人局的模仿格不再使用。' },
  col5: { name: '第 5 列', icon: 'col5', where: '扩展行动版图最右边新增的一列。', what: '放 1 或 2 个维京人，而且必须是你这一轮最后一次放置；放 2 个时还可以额外打出 1 张职业卡。' },
  artisan: { name: '手工工棚', icon: 'artisan', where: '开局每人随机发一块，先放在自己旁边，要建了才能用。', what: '你造工棚时可以改为造它，自选一面，一局只能造一次。上面有存放豆子、鱼、蜂蜜酒、兽皮、亚麻布、铁矿的格子，放进去的东西随时能拿出来再用，终局才算。' },
  horse: { name: '马', icon: 'horse', where: '红色的马板块，背面是怀孕的马。', what: '和羊、牛一样两轮生一匹；算红色物品，也算动物。终局每匹 6 分，怀孕的 8 分。' },
  pig: { name: '猪', icon: 'pig', where: '红色的猪板块，背面是橙色的香草，没有怀孕的一面。', what: '有 2 只以上，每轮繁殖阶段都再多 1 只。可以从牲畜市场、探索版图奖励拿，或者把香草升级成猪。终局每只 1 分。' },
  smallemig: { name: '小移民', icon: 'smallemig', where: '窄长的小移民板块，放在扩展的船只供应板上。', what: '在移民格上交回 1 艘捕鲸船，把一块小移民板块放到宴会桌上，本身不花钱。扩展设计师说明：它在宴会桌上只占 1 格，终局 7 分。' },
  vp: { name: '胜利点标记', icon: 'vp', where: '圆形标记，4 分、3 分、2 分三种，共 16 枚。', what: '每次可以打出职业卡时，可以改为弃掉这张卡，拿一枚还剩下的胜利点标记。弃掉的卡不生效也不计分；标记的分记在计分表职业卡一行。' },
  theft: { name: '偷窃', icon: 'theft', where: '扩展行动版图上的新行动格，要用商船。', what: '像抢劫一样掷骰，按结果拿一块剑值不超过它的特殊板块或物品；可以用图上画的武器加点，但不能用石头。失败时，图上画的每种武器各拿 1 张。' },
  nwexplore: { name: '扩展探索版图', icon: 'nwexplore', where: '4 块新的双面探索版图，右下角印着字母 A 到 D；3、4 人局再加修订版的基础探索版图。', what: '取代基础游戏的探索版图。右上角印着要用哪种船、在哪一列的格子拿；翻面时同字母的版图一起翻。' }
};

// The script: what to read aloud. Every important element gets one sentence; how it is ruled exactly is for the assistant.
const PARTS = [
  { title: '怎么赢', sec: 30, lines: [
    { b: '这局玩《奥丁的盛宴》。我先讲一遍主流程，讲完再一条条过注意事项。', n: '这局玩《奥丁的盛宴》，带挪威扩展。我先讲一遍主流程，讲完再一条条过注意事项。' },
    '我们都是维京部族的首领：种地养牲口、做手工、出海突袭、探索新岛，把家业攒起来。',
    '标准局打 7 轮，快速局 6 轮，最后总分最高的人赢。',
    '核心是你面前的{部落版图|homeboard}：上面满是{负分格|minus}，要用物品板块盖住，终局没盖住的每格扣 1 分。',
    { b: '加分来自船、{探索版图|explore}、房屋、牛羊、{职业卡|occupation}和银币，分值都印在{盾牌|shield}里。', n: '加分来自船、{探索版图|nwexplore}、房屋、牛羊马猪、{职业卡|occupation}和{胜利点标记|vp}、银币，分值都印在{盾牌|shield}里。' }
  ], ask: ['终局怎么计分？', '标准模式（长局）和快速模式（短局）有什么不同？'] },
  { title: '每一轮', sec: 35, lines: [
    '每轮开始，每人从{宴会桌|banquet}上多拿 1 个{维京人|viking}，人手一轮比一轮多。',
    '然后按{收获标记|harvest}拿农产品，每人抽 1 张{武器卡|weapon}。',
    '接着是行动阶段，大家轮流放维京人，这是一轮的主体。',
    '行动之后：按{收入斜线|incomediag}领银币，羊和牛繁殖，开宴会，再按{奖励物品格|bonus}领东西。',
    '每一步做什么，本站「流程」页会逐个提示，跟着点就行。'
  ], ask: ['最后一轮有什么特别？', '收入怎么算？收入对角线怎么盖？'] },
  { title: '放维京人', sec: 45, nsec: 75, lines: [
    { b: '从拿着{起始玩家驼鹿|moose}的人开始，顺时针轮流，每次把维京人放到{行动版图|actionboard}的一个空格上，马上执行。', n: '从拿着{起始玩家驼鹿|moose}的人开始，顺时针轮流，每次把维京人放到{扩展行动版图|nwboard}的一个空格上，马上执行。' },
    '一格一轮只能被占一次，好位置要抢。',
    '版图从左到右 4 {列|columns}，分别要放 1、2、3、4 个维京人；放满第 3 列先抽 1 张职业卡，放满第 4 列能多打 1 张。',
    { n: '扩展多了{第 5 列|col5}：放 1 或 2 个维京人，必须是你这一轮最后一次放置；放 2 个还能多打 1 张职业卡。' },
    '行动有这几类：造房造船、狩猎捕鲸、买牲口、做手工、从{山脉板块|mountain}拿{木头|wood}、{石头|stone}、{铁矿|ore}，升级物品，出海，移民和打职业卡。',
    { n: '扩展的新行动：用商船{偷窃|theft}、只能用武器付的钓鱼和猎驼鹿、花 1 铁矿打造小件特殊板块，还有{小移民|smallemig}。能打职业卡的时候，也可以改成弃掉它，换一枚{胜利点标记|vp}。' },
    '可以随时停手；最后一个放维京人的人，下一轮拿驼鹿先走。'
  ], ask: ['在第 3 列、第 4 列放维京人有什么额外好处？', { n: '挪威扩展的第 5 列是什么？' }, { n: '挪威扩展的偷窃行动怎么玩？' }, '行动阶段可以提前停手吗？', '下一轮谁当起始玩家？'] },
  { title: '物品和摆放', sec: 50, nsec: 55, lines: [
    '物品分四色：{橙色农产品|orange}、{红色畜产品|red}、{绿色手工品|green}、{蓝色奢侈品|blue}。',
    '交易类行动能{升级|upgrade}物品：橙变红、红变绿、绿变蓝，越往后越值钱。',
    { n: '扩展加了一批新物品，规则照样按颜色走；其中橙色的香草升级一下，翻过来就是红色的{猪|pig}。' },
    '只有绿色和蓝色物品，加上{银币|silver}和铁矿，能摆进{摆放区|placement}；绿色不能和绿色挨着，所以最终要靠蓝色。',
    '盖住{收入斜线|incomediag}上的数字，收入就涨；把{奖励物品格|bonus}四周围住，每轮都送你那件东西。',
    '摆上去就不能拿回来，先在桌上比划好再放。'
  ], ask: ['部落版图上的物品怎么摆？', '奖励阶段怎么拿物品？', '收入怎么算？收入对角线怎么盖？'] },
  { title: '宴会和牛羊', sec: 35, nsec: 45, lines: [
    '{宴会桌|banquet}上空出的格子，每轮都要摆满：橙色、红色食物或 1 银币，橙挨橙、红挨红都不行。',
    '每空一格拿 1 个{庭之惩罚|thing}，终局各扣 3 分。人越来越多，宴会也越来越大，要早做准备。',
    '{羊|sheep}和{牛|cattle}每两轮生一只：有 2 只就把 1 只翻成{怀孕|pregnant}，下次繁殖再多一只。牛羊能吃，终局也算分。',
    { n: '扩展加了{马|horse}和{猪|pig}，也算红色物品：马和牛羊一样两轮生一匹；猪没有怀孕面，有 2 只就每轮多 1 只。' }
  ], ask: ['宴会桌上的食物怎么摆？', '宴会桌没摆满会怎样？', { n: '挪威扩展的马和猪怎么繁殖、怎么计分？' }, '同一种食物可以横放好几块吗？'] },
  { title: '船、探索、移民', sec: 50, nsec: 70, lines: [
    '船可以造也可以买：{捕鲸船|whaler}用来捕鲸，{商船|knarr}用来海外交易和买特殊板块，{长船|longship}用来突袭和抢劫。',
    '突袭、抢劫、狩猎都要掷{骰子|dice}，最多掷 3 次，可以花武器卡调整，失败也有安慰奖；抢得好能拿蓝色物品和{特殊板块|special}。',
    { b: '用船{探索|explore}能拿下新岛：多一块摆放区和不少分，但也带来新的负分格。', n: '用船{探索|nwexplore}能拿下新岛：多一块摆放区和不少分，也带来新的负分格；扩展的探索版图右上角印着用哪种船、在哪一列拿。' },
    '{移民|emigrate}：付当前轮数的银币，把商船或长船翻面放上宴会桌，以后宴会少摆几格，终局还值很多分。',
    { n: '扩展还有{小移民|smallemig}：在移民格上交回 1 艘捕鲸船，免费放一块小移民板块上宴会桌。' },
    '还能建{工棚|shed}、{石屋|stonehouse}、{长屋|longhouse}：本身有分，也带负分格，石屋和长屋里还能放东西。',
    { n: '每人开局随机拿一块{手工工棚|artisan}：造工棚时可以改为造它，一局只能造一次，上面还能存放东西。' }
  ], ask: ['突袭、抢劫、狩猎怎么掷骰？', '探索需要什么条件？', { b: '移民要花多少钱？', n: '挪威扩展的移民有什么变化？什么是小移民？' }] },
  { title: '结束和计分', sec: 25, nsec: 30, lines: [
    '最后一轮的宴会一结束，游戏就结束。',
    { b: '加分：船、移民、探索版图、房屋、牛羊、打出的职业卡、手边的银币，还有{英格兰王冠|crown}。', n: '加分：船、移民、探索版图、房屋和手工工棚、牛羊马猪、打出的职业卡和胜利点标记、手边的银币，还有{英格兰王冠|crown}。' },
    '扣分：所有版图上没盖住的{负分格|minus}，每个{庭之惩罚|thing}扣 3。',
    '本站「计分」页每人用自己的手机填，自动加总。流程就这些，接下来过一遍注意事项。'
  ], ask: ['放在板上的银币算分吗？', { n: '挪威扩展的胜利点标记和手工工棚记在计分本哪一行？' }, '英格兰王冠怎么得？', '同分怎么办？'] }
];

// 注意事项: the easy-to-get-wrong points outside the main flow, gone through one by one after the script. Each is a
// title and a written answer (own words, from tools/faq.json and docs/规则整理.md, which cite the rulebook pages);
// what isn't here goes to the rules assistant. An optional third item 'b' / 'n' keeps a note to one mode; the
// Norwegians notes come from the Feuerland rulebook Die Norweger and tools/faq.json.
const NOTES = [
  ['收获和繁殖的时机', '收获在每轮第 2 阶段，只给橙色农产品，看宴会桌上刚空出的那格下面的标记；长局第 3、5、7 轮没有收获。牛羊繁殖在宴会之前，所以最后一轮也会繁殖。有怀孕的就全部翻回、再得 1 只新的；没有怀孕、但有 2 只以上，就翻 1 只成怀孕。同一阶段不会既生小崽又怀孕。'],
  ['宴会桌怎么摆', '橙不能挨橙，红不能挨红，橙挨红可以；桌上只能放「1 银币」硬币，银币可以相邻，铁矿不能上桌。同一种食物（比如豆子）最多 1 块横放，其余同种只能竖放。牛羊也能拿来上桌，宴会后桌上的东西都退回供应区。每个空格拿 1 个庭之惩罚，留到终局，每个扣 3 分。'],
  ['移民要花多少钱', '付和当前轮数一样多的银币，比如第 4 轮付 4 银。把一艘商船或长船翻面，放到宴会桌最左边的空位，以后每次宴会都少摆一些格子。长船上的铁矿会丢掉，维京人不会减少；宴会桌放不下就不能再移民。终局移民的商船 18 分、长船 21 分。'],
  ['职业卡什么时候能打出', '手里的职业卡不生效、终局也不计分，必须用打职业卡的行动格打出来。另外在第 4 列放满 4 个维京人时，可以在执行行动前或后额外打出 1 张。第 3 列放满 3 个维京人时，执行行动前先抽 1 张职业卡。打出的卡按右上角计分，有的是负分。', 'b'],
  ['职业卡什么时候能打出', '手里的职业卡不生效、终局也不计分，必须用打职业卡的行动格打出来；第 4 列放满 4 个、第 5 列放 2 个维京人时，还可以额外打出 1 张。第 3 列放满 3 个维京人时，执行行动前先抽 1 张职业卡。每次能打职业卡时，也可以改成弃掉它换一枚胜利点标记。打出的卡按右上角计分，有的是负分。', 'n'],
  ['探索版图什么时候翻面', '长局第 3 到 6 轮（短局第 2 到 5 轮），依次把设得兰群岛、法罗群岛、冰岛、格陵兰岛翻成另一面，已经被人拿走的就不翻了。同时其他没被拿走的探索版图各放 2 银币，被翻的那块上的银币退回供应区。拿探索版图时，板上的银币归你；第 1 轮和最后一轮没有这一步。', 'b'],
  ['探索版图什么时候翻面', '翻面的轮次和基础游戏一样：长局第 3 到 6 轮（短局第 2 到 5 轮），依次翻 A、B、C、D。桌上同字母的版图只要还没被拿走，就一起翻；其他没被拿走的各放 2 银币，被翻的那块上的银币退回供应区。拿探索版图时，板上的银币归你；第 1 轮和最后一轮没有这一步。', 'n'],
  ['武器卡怎么用', '开局每人有弓箭、陷阱、长矛各 1 张，之后每轮第 4 阶段每人再抽 1 张，正面朝上放在自己面前。弓箭用于狩猎、陷阱用于设陷阱、长矛用于捕鲸，都可以代替木头付掉骰子结果；长剑在突袭和抢劫时每张加 1。手里剩下的武器卡终局不计分。'],
  ['狩猎、设陷阱、捕鲸怎么算成功', '这三种要掷小。掷完要付和结果一样多的木头或对应的武器卡，付得起就成功；最多掷 3 次，重掷会作废上一次。捕鲸时，你捕鲸船上的每个铁矿（包括船上印好的那个）都让结果减 1。失败拿 1 木头和 1 张对应的武器卡；设陷阱失败退回 1 个维京人、捕鲸失败退回 2 个，本轮还能再用。'],
  ['突袭和抢劫怎么算', '这两种要掷大：突袭用橙色 8 面骰，抢劫用蓝色 12 面骰，抢劫必须有长船。抢劫用铁矿最多的那艘长船，每个铁矿加 1，铁矿不消耗；突袭不能用船上的铁矿。两种都可以花石头、长剑每个加 1，然后拿剑值不超过结果的一块蓝色物品或特殊板块。失败拿 1 石头和 1 张长剑，抢劫失败还退回 1 个维京人。'],
  ['物品摆放和相邻', '绿色物品不能和绿色上下左右相邻，斜着可以；蓝色、银币、铁矿可以和同类相邻。放上去就不能再拿回来。摆错了要马上改；终局才发现的，每一对违规相邻的板块罚 1 个庭之惩罚。'],
  ['收入斜线要怎么盖', '收入是收入斜线上最小的、还没盖住的数字。要盖住一个数字，它左边、下边和左下方那一整块都得先盖满，所以要从左下往右上紧凑地摆；印着物品图案的格子算已经盖住。最后一轮的收入可以不领银币，改记到计分表的「最终收入」。'],
  ['奖励格怎样才算围住', '部落版图上印着物品图案的格子，自己空着、周围 8 格全被盖住（靠边的只有 5 格），每轮奖励阶段就给你这种物品。把物品格本身盖住，这个奖励就没了。最后一轮没有奖励阶段。'],
  ['房屋里能放什么', '石屋和长屋里能放橙、红、绿、蓝物品和银币，不能放铁矿；里面只要求橙不挨橙、红不挨红。长屋中间的两根柱子不能盖。工棚和石屋上有要用木头、石头盖的格子，终局时可以把手边剩下的木头、石头放上去。'],
  ['行动格和船的小规矩', '占了一个行动格，至少要执行它的一个效果，不能空占。同一艘船一轮里可以用在好几个不同的行动上，比如同一艘长船先抢劫、再探索。船最多 3 艘捕鲸船、4 艘大船（商船和长船）。'],
  ['终局计分容易漏的', '已经放在版图上的银币不再计分，只有手边的银币每枚 1 分。只算打出的职业卡，手里的不算。英格兰王冠额外 2 分，放在哪儿都算。庭之惩罚每个扣 3 分，从第一轮起一直累计。', 'b'],
  ['终局计分容易漏的', '已经放在版图上的银币不再计分，只有手边的银币每枚 1 分。只算打出的职业卡，手里的不算；胜利点标记记在职业卡一行，手工工棚记在工棚和房屋一行。拿去盖格子的动物不算动物分，英格兰王冠额外 2 分，放在哪儿都算。庭之惩罚每个扣 3 分，从第一轮起一直累计。', 'n'],
  ['最后一轮少了哪些步骤', '最后一轮没有翻转探索版图，宴会之后游戏立刻结束：没有奖励阶段，也不调整山脉板块、不取回维京人。结束后先把手边的木头、石头放到工棚和石屋的格子上，再开始计分。'],
  ['第 5 列', '扩展行动版图最右边新增的第 5 列，可以放 1 或 2 个维京人，但必须是你这一轮最后一次放置，放完这一轮就不能再放了。放 2 个时，除了执行行动，还可以额外打出 1 张职业卡。基础四人局的模仿格在扩展里不再使用。', 'n'],
  ['弃职业卡换胜利点标记', '每当你可以打出一张职业卡时，都可以改为把它弃掉，拿一枚还剩下的胜利点标记（共 16 枚：2 枚 4 分、6 枚 3 分、8 枚 2 分）。弃掉的卡不生效，终局也不算它的分；标记的分记在计分表职业卡一行。「移民与职业」区有一格是弃 1 张职业卡换 2 银币或 3 张新卡，这样弃掉的卡不给胜利点标记。', 'n'],
  ['手工工棚怎么用', '开局每人随机发一块，先放在旁边，要建了才能用：你造工棚时可以改为造它，自选一面，一局只能造一次。上面有存放豆子、鱼、蜂蜜酒、兽皮、亚麻布、铁矿的格子，放进去的东西随时可以拿出来另作他用，终局才算。有些格子只能放图上画的猪、牛、马、鲸肉或捕鲸船，放在这些格子里的板块上印的分不算。手工工棚的分记在工棚和房屋一行。', 'n'],
  ['马和猪', '马和羊、牛一样繁殖：有怀孕的就全部翻回、再得 1 匹，没有怀孕但有 2 匹就翻 1 匹成怀孕。猪没有怀孕面，有 2 只以上，每轮繁殖都再得 1 只。马和猪没有专门的畜栏，和牛羊放一起或放在面前都行；拿去盖建筑格子的动物不再繁殖，终局也不算分。终局马 6 分（怀孕 8 分）、猪 1 分，记在动物一行。', 'n'],
  ['小移民', '在移民格上交回 1 艘捕鲸船，拿一块小移民板块放到宴会桌上，本身不花钱。航海区第 4 列那一格，有长船就能拿任意一块探索版图，之后还可以付 2 银币做一次小移民。扩展设计师说明：小移民在宴会桌上只占 1 格，终局 7 分。', 'n'],
  ['偷窃', '偷窃要有一艘商船。像抢劫一样掷骰，按结果拿一块剑值不超过它的特殊板块或物品；可以用图上画的武器加点，但不能用石头。失败时，图上画的每种武器各拿 1 张。职业卡上说的突袭、抢劫，不包括偷窃。', 'n'],
  ['钓鱼和猎驼鹿', '扩展新增的两个狩猎格「钓鱼」和「猎驼鹿」，付骰子结果时只能用武器卡，不能用木头。失败时拿格子上画的武器卡。', 'n'],
  ['扩展的探索版图怎么摆', '4 块新探索版图取代基础游戏的那 4 块。3 人局再加 2 块修订版基础探索版图（A、B 选 1 块，C、D 选 1 块），4 人局 4 块全加。每块右上角印着要用哪种船、在哪一列的格子拿。', 'n'],
  ['要移除和要重抽的职业卡', '官方建议移除 8 张：52A、107B、115B、125C、150C、163A、170A、189B（名单印在迷你扩展 2 的规则里，扩展设计师说明适用于挪威扩展）。扩展规则书的勘误表还写了：150C 抽到就弃掉重抽；109B、110C、163A 需要的行动格不在这局里时，也弃掉重抽。其他卡在扩展下的变化，可以查职业卡速查或问规则助手。', 'n']
];

// Icon guide, grouped the way things sit on the table.
const GROUPS = [
  ['分数', ['shield', 'minus', 'thing', 'crown']],
  ['人和钱', ['viking', 'moose', 'silver']],
  ['建筑资源', ['wood', 'stone', 'ore', 'mountain']],
  ['物品', ['orange', 'red', 'green', 'blue', 'upgrade']],
  ['牛羊', ['sheep', 'cattle', 'pregnant']],
  ['船', ['whaler', 'knarr', 'longship', 'emigrate']],
  ['卡和骰子', ['weapon', 'occupation', 'dice', 'special']],
  ['版图', ['actionboard', 'columns', 'homeboard', 'placement', 'incomediag', 'bonus', 'banquet', 'harvest', 'explore']],
  ['房屋', ['shed', 'stonehouse', 'longhouse']],
  ['挪威扩展', ['nwboard', 'col5', 'nwexplore', 'artisan', 'horse', 'pig', 'smallemig', 'vp', 'theft'], 'n']
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const term = (text, id) => `<button type="button" class="term" data-t="${id}">${ICON(TERMS[id].icon)}${esc(text)}</button>`;
const line = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{([^|}]+)\|(\w+)\}/g, (_, t, id) => term(t, id));
// inside a button the terms show their icon but are not buttons themselves
const label = s => esc(s).replace(/\{([^|}]+)\|(\w+)\}/g, (_, t, id) => `<span class="tlab">${ICON(TERMS[id].icon)}${esc(t)}</span>`);
const askBtn = (text, q) => `<button type="button" class="tq" data-q="${esc(q)}">问 <span>${label(text)}</span></button>`;

// mode: 'n' with the Norwegians (default), 'b' base game only; remembered in this browser
let mode = 'n';
try { if (localStorage.getItem('odin-teach-mode') === 'b') mode = 'b'; } catch {}
const pick = x => typeof x === 'string' ? x : x[mode];          // a line or question for both modes, or {b, n}
const only = list => list.map(pick).filter(Boolean);
const notes = () => NOTES.filter(n => !n[2] || n[2] === mode);
const BASE_NOTES = new Set(NOTES.filter(n => n[2] !== 'n').map(n => n[0]));   // expansion-only notes get a tag
const secs = p => mode === 'n' && p.nsec ? p.nsec : p.sec;

function render() {
  const total = PARTS.reduce((t, p) => t + secs(p), 0) / 60;
  document.getElementById('teach').innerHTML = `
  <div class="tmode" role="group" aria-label="这局怎么玩"><span>这局</span>
    <button type="button" data-mode="n" aria-pressed="${mode === 'n'}">带挪威扩展</button><button type="button" data-mode="b" aria-pressed="${mode === 'b'}">只玩基础</button></div>
  <p class="tlead">讲的人照着念，约 ${Math.round(total)} 分钟就能开局。<b>带下划线的词</b>点一下看图和解释；有疑问点「问」，规则助手马上回答。</p>
  <nav class="tnav">${PARTS.map((p, i) => `<a href="#p${i + 1}"><i>${i + 1}</i>${p.title}</a>`).join('')}<a href="#later">注意事项</a><a href="#icons">图标速查</a></nav>
  ${PARTS.map((p, i) => `<section class="card tpart" id="p${i + 1}">
    <h2 class="h"><span><i>${i + 1}</i>${p.title}</span><small>约 ${secs(p)} 秒</small></h2>
    ${only(p.lines).map(s => `<p class="tline">${line(s)}</p>`).join('')}
    <div class="tasks"><em>桌上常见疑问</em>${only(p.ask).map(q => askBtn(q, q)).join('')}</div>
  </section>`).join('')}
  <section class="card tpart" id="later">
    <h2 class="h"><span><i>!</i>注意事项</span><small>${notes().length} 条</small></h2>
    <p class="tnote">流程讲完后，一条一条过一遍。这些是主流程之外容易出错、容易争的地方，点开念答案。</p>
    ${notes().map(([t, a, m], i) => `<details class="fq tnotei"><summary><i>${i + 1}</i>${esc(t)}${m === 'n' && !BASE_NOTES.has(t) ? '<em class="tnw">扩展</em>' : ''}</summary><p>${esc(a)}</p>
      <button type="button" class="tq tmore" data-q="${esc(`「${t}」这一条我还有疑问，请再讲讲。`)}">还有疑问？问规则助手</button></details>`).join('')}
    <p class="tnote">注意事项里没有的，点右下角「规则」问 AI。</p>
  </section>
  <a class="btn tgo" href="/">讲完了，去建房间</a>
  <a class="btn ghost tgo" href="boards">想看行动版图每一格？去版图指南</a>
  <h2 class="h" id="icons">图标速查<small>点图标看解释</small></h2>
  ${GROUPS.filter(g => !g[2] || g[2] === mode).map(([g, ids]) => `<div class="card tgrid"><h3>${g}</h3><div>${ids.map(id => `<button type="button" class="tic" data-t="${id}">${ICON(TERMS[id].icon)}<span>${TERMS[id].name}</span></button>`).join('')}</div></div>`).join('')}
  <footer>依据官方规则书 · 图片截自 Z-Man Games 官方英文规则书（<a href="https://boardgamegeek.com/filepage/136602/english-rulebook" target="_blank" rel="noopener">原文</a>）和 Feuerland Spiele 挪威扩展德文规则书（<a href="https://www.feuerland-spiele.de/fileadmin/game/Ein_Fest_fuer_Odin/Exp_1_Die_Norweger/Regelbuch.pdf" target="_blank" rel="noopener">原文</a>），版权归 Feuerland Spiele / Z-Man Games 所有 · 非官方玩家工具</footer>`;
}
render();

// The note for a term: a sheet from the bottom with the icon, where it is and what it means.
const sheet = document.createElement('div');
sheet.className = 'tsheet hidden';
document.body.appendChild(sheet);
const close = () => sheet.classList.add('hidden');
function show(id) {
  const t = TERMS[id];
  sheet.innerHTML = `<div class="tsbg"></div><div class="tsbox" role="dialog" aria-label="${esc(t.name)}">
    <div class="tshd">${ICON(t.icon, 'big')}<b>${esc(t.name)}</b><button type="button" class="tsx" aria-label="关闭">×</button></div>
    <p><em>在哪儿看到</em>${esc(t.where)}</p><p><em>什么意思</em>${esc(t.what)}</p>
    <button type="button" class="btn navy tsask" data-q="${esc(`「${t.name}」是什么，怎么用？`)}">还不懂？问规则助手</button></div>`;
  sheet.classList.remove('hidden');
}
const ask = q => { close(); window.askRules?.(q); };
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mode]');
  if (m) {
    if (m.dataset.mode === mode) return;
    mode = m.dataset.mode;
    try { localStorage.setItem('odin-teach-mode', mode); } catch {}
    return render();
  }
  const t = e.target.closest('[data-t]');
  if (t) return show(t.dataset.t);
  const q = e.target.closest('[data-q]');
  if (q) return ask(q.dataset.q);
  if (e.target.closest('.tsx,.tsbg')) close();
});
addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
