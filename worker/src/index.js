/**
 * Cloudflare Worker: MIMI 問答數據 → 飛書 Bitable
 * 
 * 部署步驟：
 * 1. 安裝 wrangler: npm install -g wrangler
 * 2. 登錄: wrangler login
 * 3. 創建項目: wrangler init mimi-sync (選 JavaScript 模板)
 * 4. 把此文件內容複製到 src/index.js
 * 5. 配置 wrangler.toml（見下方）
 * 6. 部署: wrangler deploy
 * 7. 設置環境變量: wrangler secret put FEISHU_APP_ID / FEISHU_APP_SECRET
 */

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

// 從環境變量讀取（敏感信息不硬編碼）
function getEnv(env) {
  return {
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    baseToken: env.BITABLE_BASE_TOKEN || 'XenmbYueGa1lP4sMiEhcTU0YnOg',
    tableId: env.BITABLE_TABLE_ID || 'tbl4X2EDh1wYYvrL',
  };
}

// 獲取 tenant_access_token
async function getTenantToken(appId, appSecret) {
  const resp = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Token error: ${data.msg}`);
  return data.tenant_access_token;
}

// 寫入 Bitable 記錄
async function writeRecord(token, baseToken, tableId, fields) {
  const resp = await fetch(
    `${FEISHU_BASE}/bitable/v1/apps/${baseToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Bitable write error: ${data.msg}`);
  return data;
}

// 批量寫入
async function batchWriteRecords(token, baseToken, tableId, records) {
  const resp = await fetch(
    `${FEISHU_BASE}/bitable/v1/apps/${baseToken}/tables/${tableId}/records/batch_create`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ records: records.map(r => ({ fields: r })) }),
    }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`Batch write error: ${data.msg}`);
  return data;
}

// 數據映射：localStorage 記錄 → Bitable 字段
function mapRecord(record) {
  const scenarioLabels = {
    productivity: '辦公與專業創作', gaming: '遊戲電競', media: '追劇與學習',
    creative: '創意設計', reading: '閱讀/兒童', portable: '便攜出行',
    kids: '閱讀/兒童', outdoor: '戶外辦公'
  };
  const budgetLabels = { low: '入門級 HK$1,500以下', mid: '主流級 HK$1,500–3,000', premium: '旗艦級 HK$3,000以上' };
  const sizeLabels = { compact: '小屏 ≤9吋', standard: '標準 10-11吋', large: '大屏 ≥12吋' };
  const priorityLabels = {
    performance: '性能', battery: '續航', display: '螢幕',
    price: '性價比', portable: '便攜', stylus: '手寫筆'
  };
  const accessoryLabels = { none: '不需要', stylus: '手寫筆', keyboard: '鍵盤', both: '都要' };
  const connectivityLabels = { wifi_only: '純Wi-Fi', need_4g: '需要4G', need_5g: '需要5G', no_preference: '都可以' };
  const environmentLabels = { personal: '個人使用', family: '家庭共用', office: '辦公/學校', outdoor: '戶外/移動' };

  const a = record.answers || {};
  const scenarios = Array.isArray(a.scenario) ? a.scenario : (a.scenario ? [a.scenario] : []);
  const priorities = Array.isArray(a.priority) ? a.priority : (a.priority ? [a.priority] : []);

  // multi_select 字段需要數組格式
  const scenarioValues = scenarios.map(s => scenarioLabels[s] || s).filter(Boolean);
  const priorityValues = priorities.map(p => priorityLabels[p] || p).filter(Boolean);

  return {
    '時間戳': new Date(record.timestamp).getTime() || null,
    '場景': scenarioValues.length > 0 ? scenarioValues : null,
    '預算': budgetLabels[a.budget] || a.budget || null,
    '尺寸偏好': sizeLabels[a.size] || a.size || null,
    '優先級': priorityValues.length > 0 ? priorityValues : null,
    '配件需求': accessoryLabels[a.accessory] || a.accessory || null,
    'SIM卡需求': connectivityLabels[a.connectivity] || a.connectivity || null,
    '推薦產品': record.topProduct || '',
    '匹配度': record.topScore || 0,
    '設備信息': record.deviceInfo || '',
    '已同步': true,
  };
}

export default {
  async fetch(request, env, ctx) {
    // CORS 預檢
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 健康檢查
    if (request.method === 'GET') {
      const config = getEnv(env);
      return new Response(JSON.stringify({
        status: 'ok',
        hasAppId: !!config.appId,
        hasAppSecret: !!config.appSecret,
        baseToken: config.baseToken,
        tableId: config.tableId,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const config = getEnv(env);
      const { records } = await request.json();

      if (!records || !Array.isArray(records) || records.length === 0) {
        return new Response(JSON.stringify({ error: 'No records provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 1. 獲取 token
      const token = await getTenantToken(config.appId, config.appSecret);

      // 2. 映射數據
      const bitableRecords = records.map(mapRecord);

      // 3. 批量寫入
      const result = await batchWriteRecords(token, config.baseToken, config.tableId, bitableRecords);

      return new Response(JSON.stringify({
        success: true,
        count: bitableRecords.length,
        feishuResult: result,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error('Sync error:', err);
      return new Response(JSON.stringify({
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
