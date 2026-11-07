// 接口示例：故意等待，不是参赛策略，不会自动载入。
'use strict';
module.exports={apiVersion:'1.0',name:'接口示例（不行动）',mode:'team',act(observation,memory){return {action:{},memory:{decisions:(memory.decisions||0)+1}};}};
