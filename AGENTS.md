# Injective Trade Town Agent Guide

## 地图与角色资源

本项目的城镇地图和角色应优先使用以下两个来源，不要在未明确要求时换回旧
Gentle 地图或导入 AI 生成的整张地图。

### 地图：Kenney RPG Urban Pack

- 来源：https://kenney.nl/assets/rpg-urban-pack
- 许可证：CC0。
- 基础图集：
  `public/assets/trade-town/kenney-urban-base-32.png`
- 生成图集：
  `public/assets/trade-town/kenney-urban-32.png`
- 生成脚本：
  `scripts/generate_urban_tileset.py`
- 地图布局、建筑、碰撞和标签：
  `data/urban.ts`
- 地图回归测试：
  `data/urban.test.ts`

编辑地图时遵循以下规则：

1. 保持 32×32 像素瓦片、像素整数坐标和 nearest-neighbour 渲染。
2. 不要直接手工覆盖生成后的 `kenney-urban-32.png`；修改基础资源或
   `generate_urban_tileset.py` 后重新运行：

   ```bash
   python3 scripts/generate_urban_tileset.py
   ```

3. 图集尺寸变化时，同步修改 `data/urban.ts` 中的 `tilesetpxw` 和
   `tilesetpxh`。
4. 修改地图瓦片、碰撞或图集后更新 `mapVersion`，再执行初始化，使现有
   Convex 世界迁移到新地图。
5. `origin/main` 中未带版本号的旧地图视为 v1；当前 Kenney 城镇地图正式
   版本为 `kenney-urban-v2`。不要使用 v11、v12 等内部视觉迭代号。
6. 保持道路连续、建筑入口和 Agent 出生点可通行；不要用装饰瓦片覆盖主路。
7. 中央广场应保持正方形和轴对称；当前设计不使用运河或水域。
8. 建筑不使用外侧投影；功能建筑采用较大的中文标签，无功能装饰建筑不显示
   标签。

### 角色：Universal LPC Spritesheet Character Generator

- 来源：
  https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
- 当前角色文件：
  `public/assets/trade-town/characters/`
- 角色配置：
  `data/characters.ts`
- 授权与逐层署名：
  `public/assets/trade-town/licenses/LPC-Selected-Assets-Credits.csv`
- Generator 许可证副本：
  `public/assets/trade-town/licenses/LPC-Generator-GPL-3.0.txt`

编辑角色时遵循以下规则：

1. 使用 LPC Generator 组合身体、发型、服装和配件；不要从不明来源复制
   精灵。
2. 保持当前 64×64 LPC 行走帧布局和透明背景。
3. 缩放、裁切和渲染必须使用 nearest-neighbour，禁止平滑插值。
4. 新增或替换任何 LPC 图层时，记录作者、来源 URL 和该图层的实际许可证；
   不要假设所有 LPC 图层都使用同一种许可证。
5. 同步更新 `LPC-Selected-Assets-Credits.csv`，保留项目所需署名。
6. 当前空间世界只展示 8 个 Agent 角色；不要重新加入仅用于金融后端的做市
   商角色。

## 修改后的验证流程

地图或角色变更完成后至少执行：

```bash
python3 scripts/generate_urban_tileset.py
npm test -- --runInBand
npm run build
npx convex run init
```

随后在开发服务器中目视检查：

- 地图与角色资源成功加载；
- 道路和全部入口可通行；
- 中文建筑标签清晰且没有遮挡主要入口；
- Agent 行走动画方向和帧顺序正确；
- 许可证及资源来源记录完整。
