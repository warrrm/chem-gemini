import React from 'react';
import { InquiryQuestion } from '../types/chemistry';

interface ApparatusDiagramProps {
  kind?: InquiryQuestion['apparatusDiagram'];
}

export const ApparatusDiagram: React.FC<ApparatusDiagramProps> = ({ kind }) => {
  if (!kind) return null;

  return (
    <div className="apparatus-box">
      <div className="apparatus-title">实验装置示意图</div>
      {kind === 'gas_collection_up' && (
        <svg viewBox="0 0 340 130" className="apparatus-svg" role="img" aria-label="固液常温发生与向上排空气法收集装置示意图">
          <rect width="340" height="130" rx="10" fill="#f8fafc" />
          {/* 试管发生装置 */}
          <rect x="44" y="28" width="26" height="82" rx="12" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <rect x="46" y="72" width="22" height="36" rx="10" fill="#bae6fd" />
          <circle cx="53" cy="96" r="3" fill="#334155" />
          <circle cx="61" cy="100" r="3" fill="#334155" />
          {/* 导管 */}
          <path d="M57 28 L57 16 L154 16 L154 96" fill="none" stroke="#475569" strokeWidth="2.5" />
          {/* 集气瓶 */}
          <rect x="132" y="36" width="44" height="72" rx="6" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <line x1="128" y1="36" x2="180" y2="36" stroke="#2563eb" strokeWidth="3" />
          <text x="57" y="123" textAnchor="middle" fontSize="10" fill="#475569">发生装置</text>
          <text x="154" y="123" textAnchor="middle" fontSize="10" fill="#475569">向上排空气法收集</text>
          {/* 阶梯蜡烛 */}
          <path d="M236 36 L236 104 Q236 108 240 108 L304 108 Q308 108 308 104 L308 36" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
          <rect x="252" y="84" width="10" height="22" fill="#f87171" />
          <rect x="280" y="64" width="10" height="42" fill="#fb923c" />
          <text x="272" y="123" textAnchor="middle" fontSize="10" fill="#475569">性质验证烧杯</text>
        </svg>
      )}

      {kind === 'limestone_acid' && (
        <svg viewBox="0 0 340 130" className="apparatus-svg" role="img" aria-label="长颈漏斗与锥形瓶制取二氧化碳装置示意图">
          <rect width="340" height="130" rx="10" fill="#f8fafc" />
          {/* 锥形瓶 */}
          <polygon points="78,42 98,42 120,108 56,108" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <polygon points="64,84 112,84 118,106 58,106" fill="#e0f2fe" />
          {/* 长颈漏斗（下端伸入液面以下） */}
          <path d="M74 12 L90 12 L84 24 L84 98" fill="none" stroke="#2563eb" strokeWidth="2" />
          <text x="36" y="96" fontSize="9" fill="#1d4ed8">液封</text>
          {/* 导气管 */}
          <path d="M92 42 L92 22 L195 22 L195 96" fill="none" stroke="#475569" strokeWidth="2" />
          {/* 集气瓶 */}
          <rect x="174" y="42" width="42" height="66" rx="5" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          {/* 澄清石灰水试管 */}
          <rect x="262" y="42" width="22" height="66" rx="10" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <rect x="264" y="76" width="18" height="30" rx="8" fill="#dbeafe" />
          <text x="88" y="123" textAnchor="middle" fontSize="10" fill="#475569">锥形瓶+长颈漏斗</text>
          <text x="195" y="123" textAnchor="middle" fontSize="10" fill="#475569">集气瓶</text>
          <text x="273" y="123" textAnchor="middle" fontSize="10" fill="#475569">澄清石灰水</text>
        </svg>
      )}

      {kind === 'metal_displacement' && (
        <svg viewBox="0 0 340 130" className="apparatus-svg" role="img" aria-label="铁钉与硫酸铜溶液反应装置示意图">
          <rect width="340" height="130" rx="10" fill="#f8fafc" />
          <path d="M90 28 L90 102 Q90 108 96 108 L164 108 Q170 108 170 102 L170 28" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <rect x="92" y="54" width="76" height="52" rx="4" fill="#7dd3fc" />
          <line x1="115" y1="36" x2="145" y2="98" stroke="#9a3412" strokeWidth="5" strokeLinecap="round" />
          <text x="130" y="123" textAnchor="middle" fontSize="10" fill="#475569">硫酸铜溶液 + 铁钉</text>

          <rect x="234" y="28" width="24" height="78" rx="11" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <rect x="236" y="64" width="20" height="40" rx="9" fill="#38bdf8" />
          <circle cx="246" cy="88" r="6" fill="#2563eb" />
          <text x="246" y="123" textAnchor="middle" fontSize="10" fill="#475569">滴加氢氧化钠溶液</text>
        </svg>
      )}

      {kind === 'solution_test' && (
        <svg viewBox="0 0 340 130" className="apparatus-svg" role="img" aria-label="溶液滴加与酸碱指示剂实验示意图">
          <rect width="340" height="130" rx="10" fill="#f8fafc" />
          {/* 胶头滴管 */}
          <rect x="163" y="10" width="14" height="16" rx="6" fill="#ef4444" />
          <polygon points="166,26 174,26 171,48 169,48" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
          {/* 烧杯 */}
          <path d="M126 54 L126 104 Q126 110 132 110 L208 110 Q214 110 214 104 L214 54" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <rect x="128" y="74" width="84" height="34" rx="4" fill="#fecdd3" />
          <line x1="194" y1="42" x2="168" y2="104" stroke="#64748b" strokeWidth="2.5" />
          <text x="170" y="124" textAnchor="middle" fontSize="10" fill="#475569">胶头滴管逐滴滴加并不断搅拌</text>
        </svg>
      )}

      {(kind === 'heating_solid' || kind === 'gas_collection_water') && (
        <svg viewBox="0 0 340 130" className="apparatus-svg" role="img" aria-label="固体加热发生装置示意图">
          <rect width="340" height="130" rx="10" fill="#f8fafc" />
          <rect x="60" y="46" width="110" height="22" rx="10" transform="rotate(8 115 57)" fill="#ffffff" stroke="#475569" strokeWidth="2" />
          <text x="170" y="118" textAnchor="middle" fontSize="10" fill="#475569">固体加热发生装置（试管口略向下倾斜）</text>
        </svg>
      )}
    </div>
  );
};
