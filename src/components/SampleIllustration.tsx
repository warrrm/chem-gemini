import React from 'react';
import { SampleHotspot, SampleSvgKind } from '../types/chemistry';

interface SampleIllustrationProps {
  svgKind: SampleSvgKind;
  hotspots?: SampleHotspot[];
  selectedHotspotId?: string | null;
  onSelectHotspot?: (hotspot: SampleHotspot) => void;
  compact?: boolean;
}

export const SampleIllustration: React.FC<SampleIllustrationProps> = ({
  svgKind,
  hotspots,
  selectedHotspotId,
  onSelectHotspot,
  compact = false,
}) => {
  return (
    <div className={`sample-illustration-wrap ${compact ? 'is-compact' : ''}`}>
      <div className="sample-svg-stage">
        {svgKind === 'hcl_bottle' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="贴有稀盐酸标签的试剂瓶示意样例">
            <rect width="360" height="220" rx="14" fill="#eef6ff" />
            <rect x="0" y="176" width="360" height="44" fill="#dbeafe" />
            <rect x="156" y="24" width="48" height="24" rx="4" fill="#2563eb" />
            <rect x="162" y="48" width="36" height="22" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="2" />
            <rect x="122" y="70" width="116" height="114" rx="16" fill="#ffffff" stroke="#60a5fa" strokeWidth="3" />
            <rect x="127" y="114" width="106" height="65" rx="11" fill="#e0f2fe" />
            <rect x="136" y="92" width="88" height="58" rx="6" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2" />
            <line x1="144" y1="104" x2="216" y2="104" stroke="#93c5fd" strokeWidth="2" />
            <text x="180" y="128" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e3a8a">稀盐酸</text>
            <text x="180" y="143" textAnchor="middle" fontSize="10" fill="#475569">实验室常用酸溶液</text>
          </svg>
        )}

        {svgKind === 'naoh_bottle' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="贴有氢氧化钠标签的广口瓶示意样例">
            <rect width="360" height="220" rx="14" fill="#f0fdf4" />
            <rect x="0" y="176" width="360" height="44" fill="#dcfce7" />
            <rect x="142" y="24" width="76" height="24" rx="5" fill="#0f766e" />
            <rect x="148" y="48" width="64" height="18" fill="#ccfbf1" stroke="#14b8a6" strokeWidth="2" />
            <rect x="116" y="66" width="128" height="118" rx="14" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
            <ellipse cx="155" cy="166" rx="22" ry="8" fill="#e2e8f0" />
            <ellipse cx="188" cy="168" rx="26" ry="8" fill="#cbd5e1" />
            <ellipse cx="172" cy="160" rx="24" ry="7" fill="#f1f5f9" />
            <rect x="132" y="88" width="96" height="58" rx="6" fill="#ffffff" stroke="#0f766e" strokeWidth="2" />
            <text x="180" y="118" textAnchor="middle" fontSize="17" fontWeight="700" fill="#115e59">氢氧化钠</text>
            <text x="180" y="136" textAnchor="middle" fontSize="10" fill="#b91c1c">强腐蚀性 · 密封保存</text>
          </svg>
        )}

        {svgKind === 'unlabeled_liquid' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="无标签澄清无色液体烧杯示意样例">
            <rect width="360" height="220" rx="14" fill="#f8fafc" />
            <rect x="0" y="176" width="360" height="44" fill="#e2e8f0" />
            <path d="M126 56 L126 172 Q126 182 136 182 L224 182 Q234 182 234 172 L234 56" fill="#ffffff" stroke="#64748b" strokeWidth="3" />
            <path d="M120 56 L240 56" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            <rect x="129" y="104" width="102" height="75" rx="6" fill="#e0f2fe" opacity="0.8" />
            <ellipse cx="180" cy="104" rx="51" ry="6" fill="#bae6fd" />
            <circle cx="180" cy="140" r="18" fill="#ffffff" stroke="#94a3b8" strokeDasharray="3 3" />
            <text x="180" y="146" textAnchor="middle" fontSize="18" fontWeight="700" fill="#475569">?</text>
            <text x="180" y="38" textAnchor="middle" fontSize="12" fill="#64748b">无标签澄清无色液体</text>
          </svg>
        )}

        {svgKind === 'limestone_rock' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="石灰石矿石标本示意样例">
            <rect width="360" height="220" rx="14" fill="#f1f5f9" />
            <rect x="0" y="176" width="360" height="44" fill="#cbd5e1" />
            <polygon points="115,156 105,112 138,76 196,68 242,96 252,144 218,168 148,170" fill="#cbd5e1" stroke="#64748b" strokeWidth="3" />
            <polygon points="138,76 196,68 182,116 128,118" fill="#e2e8f0" />
            <line x1="145" y1="125" x2="215" y2="112" stroke="#94a3b8" strokeWidth="2" />
            <line x1="158" y1="145" x2="225" y2="138" stroke="#94a3b8" strokeWidth="2" />
            <rect x="118" y="182" width="124" height="26" rx="5" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
            <text x="180" y="199" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b">标本：天然石灰石</text>
          </svg>
        )}

        {svgKind === 'lab_bench_multi' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="实验桌多物体示意样例：铁钉、硫酸铜溶液、烧杯">
            <rect width="360" height="220" rx="14" fill="#eff6ff" />
            <rect x="0" y="176" width="360" height="44" fill="#cbd5e1" />
            <g>
              <rect x="36" y="142" width="90" height="34" rx="6" fill="#ffffff" stroke="#94a3b8" />
              <line x1="52" y1="156" x2="108" y2="156" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
              <rect x="48" y="149" width="6" height="14" rx="2" fill="#334155" />
              <polygon points="108,153 118,156 108,159" fill="#475569" />
              <text x="81" y="128" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b">洁净铁钉</text>
            </g>
            <g>
              <rect x="166" y="54" width="32" height="16" rx="3" fill="#1d4ed8" />
              <rect x="144" y="70" width="76" height="106" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
              <rect x="148" y="106" width="68" height="66" rx="8" fill="#38bdf8" />
              <rect x="150" y="88" width="64" height="34" rx="4" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1.5" />
              <text x="182" y="109" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e3a8a">硫酸铜溶液</text>
            </g>
            <g>
              <path d="M254 80 L254 168 Q254 176 262 176 L318 176 Q326 176 326 168 L326 80" fill="#ffffff" fillOpacity="0.85" stroke="#64748b" strokeWidth="2.5" />
              <line x1="250" y1="80" x2="330" y2="80" stroke="#64748b" strokeWidth="2.5" />
              <line x1="264" y1="105" x2="278" y2="105" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="264" y1="125" x2="282" y2="125" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="264" y1="145" x2="278" y2="145" stroke="#94a3b8" strokeWidth="1.5" />
              <text x="290" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">玻璃烧杯</text>
            </g>
          </svg>
        )}

        {svgKind === 'phenol_bottle' && (
          <svg viewBox="0 0 360 220" className="sample-svg" role="img" aria-label="贴有苯酚标签的棕色试剂瓶示意样例">
            <rect width="360" height="220" rx="14" fill="#fef2f2" />
            <rect x="0" y="176" width="360" height="44" fill="#fee2e2" />
            <rect x="156" y="24" width="48" height="24" rx="4" fill="#7f1d1d" />
            <rect x="122" y="66" width="116" height="118" rx="16" fill="#92400e" stroke="#78350f" strokeWidth="3" />
            <rect x="134" y="92" width="92" height="58" rx="6" fill="#ffffff" stroke="#dc2626" strokeWidth="2" />
            <text x="180" y="118" textAnchor="middle" fontSize="18" fontWeight="700" fill="#991b1b">苯酚</text>
            <text x="180" y="136" textAnchor="middle" fontSize="10" fill="#7f1d1d">有机试剂 · 高中内容</text>
          </svg>
        )}

        {!compact && hotspots && hotspots.length > 0 && onSelectHotspot && (
          <div className="hotspot-overlay" aria-label="可点选物体区域">
            {hotspots.map((hs) => {
              const [x, y, w, h] = hs.bbox;
              const isSelected = selectedHotspotId === hs.id;
              return (
                <button
                  key={hs.id}
                  type="button"
                  className={`hotspot-box ${isSelected ? 'is-selected' : ''} ${hs.isApparatus ? 'is-apparatus' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
                  onClick={() => onSelectHotspot(hs)}
                >
                  <span className="hotspot-tag">{hs.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="sample-caption">示意样例，非真实照片</div>
    </div>
  );
};
