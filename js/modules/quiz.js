/**
 * 智能推荐问答引擎 v2
 * 5步问答 + 匹配度评分 + 推荐理由 + 注意事项
 */
const QuizEngine = (() => {
  let currentStep = 0;
  let answers = {};

  const steps = [
    {
      key: "scenario",
      question: "您主要用平板做什么？",
      desc: "选择最核心的使用场景，可多选",
      multi: true,
      options: SCENARIOS
    },
    {
      key: "budget",
      question: "您的预算范围？",
      desc: "含配件预算更准确",
      options: BUDGETS
    },
    {
      key: "size",
      question: "您偏好的屏幕尺寸？",
      desc: "大屏沉浸，小屏便携",
      options: [
        { id: "compact", icon: "📱", label: "小屏 (≤9吋)", desc: "单手可握，通勤首选" },
        { id: "standard", icon: "📟", label: "标准 (10-11吋)", desc: "均衡之选，最主流" },
        { id: "large", icon: "🖥️", label: "大屏 (≥12吋)", desc: "沉浸体验，生产力" }
      ]
    },
    {
      key: "priority",
      question: "您最看重什么？",
      desc: "选择第一优先级",
      options: [
        { id: "performance", icon: "⚡", label: "性能", desc: "芯片速度、流畅度" },
        { id: "battery", icon: "🔋", label: "续航", desc: "电池容量、充电速度" },
        { id: "display", icon: "🖥️", label: "屏幕", desc: "显示效果、刷新率" },
        { id: "price", icon: "💰", label: "性价比", desc: "价格实惠、够用就好" },
        { id: "portable", icon: "🏃", label: "便携", desc: "轻薄、单手可握" },
        { id: "stylus", icon: "✍️", label: "手写笔", desc: "笔记、绘画、标注" }
      ]
    },
    {
      key: "accessory",
      question: "需要哪些配件？",
      desc: "影响预算和推荐结果",
      options: [
        { id: "none", icon: "🚫", label: "不需要", desc: "纯平板使用" },
        { id: "stylus", icon: "✍️", label: "手写笔", desc: "笔记/绘画" },
        { id: "keyboard", icon: "⌨️", label: "键盘", desc: "办公/打字" },
        { id: "both", icon: "✍️⌨️", label: "都要", desc: "完整生产力" }
      ]
    }
  ];

  function getProgress() {
    return ((currentStep) / steps.length) * 100;
  }

  function renderQuiz(container) {
    if (currentStep >= steps.length) {
      showResult(container);
      return;
    }
    const step = steps[currentStep];
    const progress = getProgress();

    container.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="quiz-step-label">問題 ${currentStep + 1} / ${steps.length}</div>
      <div class="quiz-question">${step.question}</div>
      <div class="quiz-desc">${step.desc}</div>
      <div class="quiz-options" style="grid-template-columns: repeat(${step.options.length <= 3 ? step.options.length : (step.options.length <= 4 ? 2 : 2)}, minmax(0, 1fr));">
        ${step.options.map(opt => `
          <div class="quiz-option ${answers[step.key] === opt.id ? 'selected' : ''}" style="padding: 12px 8px;"
               onclick="QuizEngine.select('${step.key}', '${opt.id}', ${step.multi || false})">
            <div class="quiz-option-icon">${opt.icon}</div>
            <div class="quiz-option-label" style="font-size:13px;">${opt.label}</div>
            ${opt.desc ? `<div class="quiz-option-desc" style="font-size:11px;margin-top:2px;">${opt.desc}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${currentStep > 0 ? `
        <div style="margin-top:16px;text-align:center;">
          <button class="btn-outline" onclick="QuizEngine.back()" style="font-size:13px;padding:8px 16px;">
            ← 上一步
          </button>
        </div>
      ` : ''}
    `;
  }

  function select(key, value, multi) {
    if (multi) {
      if (!answers[key]) answers[key] = [];
      const idx = answers[key].indexOf(value);
      if (idx >= 0) answers[key].splice(idx, 1);
      else answers[key].push(value);
      // 不自动前进，让用户确认
      const container = document.getElementById('quiz-card');
      renderQuiz(container);
    } else {
      answers[key] = value;
      currentStep++;
      const container = document.getElementById('quiz-card');
      renderQuiz(container);
    }
  }

  function back() {
    if (currentStep > 0) {
      currentStep--;
      const container = document.getElementById('quiz-card');
      renderQuiz(container);
    }
  }

  function showResult(container) {
    const results = scoreAndFilter();

    // 數據收集：保存本次問答到 localStorage
    QuizData.saveResponse(answers, results);

    const html = results.length > 0
      ? results.map((r, i) => renderResultCard(r, i === 0)).join('')
      : '<div class="text-center mt-6"><p>暂无完全匹配的机型，建议查看全部产品</p></div>';

    // 本地統計
    const stats = QuizData.getStats();
    const statsHtml = renderStats(stats);

    container.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <div class="quiz-step-label">🎯 为您推荐 ${results.length} 款机型</div>
        <button class="btn-outline" onclick="QuizEngine.restart()" style="font-size:13px;padding:8px 16px;">
          🔄 重新选择
        </button>
      </div>
      <div class="fade-in">${html}</div>
      ${statsHtml}
    `;
  }

  function renderStats(stats) {
    if (stats.total === 0) return '';

    function bar(label, count, max) {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:12px;color:#6B7280;width:70px;text-align:right;flex-shrink:0;">${label}</span>
        <div style="flex:1;height:16px;background:#F3F4F6;border-radius:8px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#FF6700,#FF8533);border-radius:8px;transition:width 0.5s ease;"></div>
        </div>
        <span style="font-size:11px;color:#9CA3AF;width:24px;">${count}</span>
      </div>`;
    }

    function section(title, obj) {
      const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return '';
      const max = entries[0][1];
      return `<div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">${title}</div>
        ${entries.map(([k, v]) => bar(k, v, max)).join('')}
      </div>`;
    }

    return `
      <div style="margin-top:32px;padding:20px;background:white;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:700;color:#111827;">📊 數據洞察</div>
          <div style="font-size:12px;color:#6B7280;">已收集 ${stats.total} 份問答 · ${stats.synced} 份已同步</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${section('🎯 場景偏好', stats.scenarios)}
          ${section('💰 預算分佈', stats.budgets)}
          ${section('📱 尺寸偏好', stats.sizes)}
          ${section('⚡ 優先級', stats.priorities)}
        </div>
        ${Object.keys(stats.topProducts).length > 0 ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid #F3F4F6;">
            <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">🏆 熱門推薦</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${Object.entries(stats.topProducts).sort((a,b) => b[1]-a[1]).map(([k,v]) => 
                `<span style="background:#FFF7ED;color:#FF6700;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:500;">${k} ×${v}</span>`
              ).join('')}
            </div>
          </div>
        ` : ''}
        <div style="margin-top:16px;text-align:center;">
          <button onclick="QuizData.exportJSON();" style="font-size:11px;color:#9CA3AF;background:none;border:none;cursor:pointer;text-decoration:underline;">📥 匯出數據 (JSON)</button>
        </div>
      </div>
    `;
  }

  function scoreAndFilter() {
    let scored = PRODUCTS.map(p => {
      let score = 0;
      let reasons = [];
      let warnings = [];

      // 场景匹配 (0-30分)
      if (answers.scenario) {
        const scenarios = Array.isArray(answers.scenario) ? answers.scenario : [answers.scenario];
        const matchCount = scenarios.filter(s => p.scenarios.includes(s)).length;
        score += (matchCount / scenarios.length) * 30;
        if (matchCount > 0) reasons.push(`支持${scenarios.filter(s => p.scenarios.includes(s)).map(s => SCENARIOS.find(sc => sc.id === s)?.label).join('、')}`);
        else warnings.push(`不完全匹配您选择的使用场景`);
      }

      // 预算匹配 (0-25分)
      if (answers.budget) {
        const budget = BUDGETS.find(b => b.id === answers.budget);
        if (budget) {
          if (p.price <= budget.max) {
            score += 25;
            reasons.push(`在预算范围内`);
          } else {
            const over = p.price - budget.max;
            score += Math.max(0, 25 - (over / 100) * 5);
            warnings.push(`超出预算 HK$${over.toLocaleString()}`);
          }
        }
      }

      // 尺寸匹配 (0-20分)
      if (answers.size) {
        if (answers.size === 'compact' && p.size <= 9.5) { score += 20; reasons.push(`${p.sizeLabel}小屏设计`); }
        else if (answers.size === 'standard' && p.size > 9.5 && p.size < 11.5) { score += 20; reasons.push(`${p.sizeLabel}标准尺寸`); }
        else if (answers.size === 'large' && p.size >= 11.5) { score += 20; reasons.push(`${p.sizeLabel}大屏沉浸`); }
        else { warnings.push(`屏幕尺寸与偏好不完全匹配`); }
      }

      // 优先级匹配 (0-15分)
      if (answers.priority) {
        switch (answers.priority) {
          case 'performance':
            if (p.chipBrand === 'Qualcomm' && p.chip.includes('8')) { score += 15; reasons.push('旗舰级芯片'); }
            else if (p.chipBrand === 'MediaTek' && p.chip.includes('9')) { score += 14; reasons.push('旗舰级芯片'); }
            else { score += 5; }
            break;
          case 'battery':
            if (p.battery >= 10000) { score += 15; reasons.push(`${p.battery}mAh超大电池`); }
            else if (p.battery >= 9000) { score += 12; reasons.push(`${p.battery}mAh大电池`); }
            else { score += 5; }
            break;
          case 'display':
            if (p.panel === 'OLED') { score += 15; reasons.push('OLED顶级屏幕'); }
            else if (p.refreshRate >= 144) { score += 12; reasons.push(`${p.refreshRate}Hz高刷屏`); }
            else { score += 5; }
            break;
          case 'price':
            if (p.price <= 1500) { score += 15; reasons.push('极致性价比'); }
            else if (p.price <= 2500) { score += 12; reasons.push('高性价比'); }
            else { score += 5; }
            break;
          case 'portable':
            if (p.weight <= 300) { score += 15; reasons.push(`${p.weight}g超轻机身`); }
            else if (p.weight <= 400) { score += 10; reasons.push(`${p.weight}g轻薄设计`); }
            else { score += 3; }
            break;
          case 'stylus':
            if (p.stylus) { score += 15; reasons.push('支持手写笔'); }
            else { score += 0; warnings.push('不支持手写笔'); }
            break;
        }
      }

      // 配件匹配 (0-10分)
      if (answers.accessory) {
        if (answers.accessory === 'none') { score += 10; }
        else if (answers.accessory === 'stylus' && p.stylus) { score += 10; reasons.push('支持手写笔'); }
        else if (answers.accessory === 'keyboard' && p.keyboard) { score += 10; reasons.push('支持键盘'); }
        else if (answers.accessory === 'both' && p.stylus && p.keyboard) { score += 10; reasons.push('手写笔+键盘全支持'); }
        else { warnings.push(`配件支持不完全匹配`); }
      }

      // 基础分（评分）
      score += p.rating * 2;

      return { product: p, score: Math.min(100, Math.round(score)), reasons, warnings };
    });

    // 按分数排序，取前5
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function renderResultCard(result, isTop) {
    const { product: p, score, reasons, warnings } = result;
    return `
      <div class="result-card mb-4" style="${isTop ? 'border:2px solid var(--mi-orange);' : ''}">
        <div class="result-header" style="${isTop ? '' : 'background:linear-gradient(135deg,#374151,#111827);'}">
          <div class="result-badge">${isTop ? '🏆 最佳推荐' : `第 ${['一','二','三','四','五'][['一','二','三','四','五'].indexOf(['一','二','三','四','五'][0])]} 推荐`}</div>
          <div class="result-name">${p.name}</div>
          <div class="result-tagline">${p.highlight}</div>
          <div style="margin-top:12px;display:flex;align-items:center;gap:12px;">
            <div style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:20px;font-size:14px;font-weight:700;">
              匹配度 ${score}%
            </div>
            <div style="font-size:13px;opacity:0.8;">
              ⭐ ${p.rating} · ${p.tag}
            </div>
          </div>
        </div>
        <div class="result-body">
          <div class="result-price">
            HK$${p.price.toLocaleString()}
            <small>/起</small>
          </div>
          <div class="result-specs-grid">
            <div class="spec-item">
              <div class="spec-item-label">屏幕</div>
              <div class="spec-item-value">${p.sizeLabel} ${p.panel} ${p.refreshRate}Hz</div>
            </div>
            <div class="spec-item">
              <div class="spec-item-label">处理器</div>
              <div class="spec-item-value">${p.chip}</div>
            </div>
            <div class="spec-item">
              <div class="spec-item-label">电池/充电</div>
              <div class="spec-item-value">${p.battery}mAh / ${p.charging}W</div>
            </div>
            <div class="spec-item">
              <div class="spec-item-label">存储</div>
              <div class="spec-item-value">${p.ram}GB + ${p.storage}GB</div>
            </div>
          </div>

          ${reasons.length > 0 ? `
            <div class="mt-4">
              <strong style="color:#059669;">✅ 推荐理由：</strong>
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">
                ${reasons.map(r => `<span style="background:#ECFDF5;color:#059669;padding:4px 10px;border-radius:12px;font-size:12px;">${r}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${warnings.length > 0 ? `
            <div class="mt-2">
              <strong style="color:#D97706;">⚠️ 注意事项：</strong>
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">
                ${warnings.map(w => `<span style="background:#FFFBEB;color:#D97706;padding:4px 10px;border-radius:12px;font-size:12px;">${w}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin-top:12px;font-size:13px;color:var(--mi-gray-500);">
            🎯 适合：${p.targetUser}
          </div>

          <div class="result-actions">
            <a href="${p.buyLink}" target="_blank" class="btn-primary" style="text-decoration:none;text-align:center;">
              前往购买 →
            </a>
            <button class="btn-outline" onclick="Favorites.toggle('${p.id}')">
              ❤️ 收藏
            </button>
            <button class="btn-outline" onclick="Compare.toggle('${p.id}')" style="font-size:13px;">
              ⚖️ 加入对比
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function restart() {
    currentStep = 0;
    answers = {};
    const container = document.getElementById('quiz-card');
    renderQuiz(container);
  }

  return { renderQuiz, select, back, restart, getProgress };
})();
