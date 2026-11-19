import React, { useId } from 'react';
import { buildMicroLegend, describeMicroDiagram, formatIonCharge, getAtomStyle } from '../modules/knowledge/microDiagram';
import { MicroBondStyle, MicroParticle, SubstanceComposition } from '../types/microstructure';

const BOND_COLOR = '#475569';

function Bond({ x1, y1, x2, y2, style }: { x1: number; y1: number; x2: number; y2: number; style?: MicroBondStyle }) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const nx = (y1 - y2) / length;
  const ny = (x2 - x1) / length;
  if (style === 'towards') {
    return <polygon points={`${x1},${y1} ${x2 + nx * 7},${y2 + ny * 7} ${x2 - nx * 7},${y2 - ny * 7}`} fill={BOND_COLOR} />;
  }
  if (style === 'away') {
    // 逐渐变宽的虚楔线：从纸面内的原子指向纸面后方。
    return <>{[0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82].map(t => {
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      return <line key={t} x1={x - nx * 7 * t} y1={y - ny * 7 * t} x2={x + nx * 7 * t} y2={y + ny * 7 * t}
        stroke={BOND_COLOR} strokeWidth="2" />;
    })}</>;
  }
  const offsets = style === 'double' ? [-3, 3] : style === 'triple' ? [-6, 0, 6] : [0];
  return <>{offsets.map(offset => <line key={offset} x1={x1 + offset * nx} y1={y1 + offset * ny}
    x2={x2 + offset * nx} y2={y2 + offset * ny} stroke={BOND_COLOR} strokeWidth="3" strokeLinecap="round" />)}</>;
}

function ParticleSvg({ particle, charge, compact }: { particle: MicroParticle; charge?: number; compact: boolean }) {
  const atoms = particle.atoms.map(([symbol, x, y]) => ({ symbol, x, y, ...getAtomStyle(symbol) }));
  // 用户看到的是整个带电微粒的括号和右上角电荷，而非贴在某个原子旁的标记。
  const left = Math.min(...atoms.map(({ x, radius }) => x - radius)) - 7;
  const right = Math.max(...atoms.map(({ x, radius }) => x + radius)) + 7;
  const top = Math.min(...atoms.map(({ y, radius }) => y - radius)) - 7;
  const bottom = Math.max(...atoms.map(({ y, radius }) => y + radius)) + 7;
  return (
    <svg className="micro-svg" viewBox={compact ? '-76 -84 181 162' : '-112 -76 224 152'} aria-hidden="true">
      {particle.bonds.map(([from, to, style]) => (
        <g key={`${from}-${to}`} data-micro-bond={`${from}-${to}`} data-bond-style={style ?? 'line'}>
          <Bond x1={atoms[from].x} y1={atoms[from].y} x2={atoms[to].x} y2={atoms[to].y} style={style} />
        </g>
      ))}
      {atoms.map(({ symbol, x, y, radius, fill, stroke, textColor }, index) => (
        <g key={index} transform={`translate(${x}, ${y})`} data-micro-atom={symbol}>
          <circle r={radius} fill={fill} stroke={stroke} strokeWidth="1.5" />
          <text textAnchor="middle" dy="0.35em" fontSize={symbol === 'H' ? 13 : 15} fontWeight="700" fill={textColor}>{symbol}</text>
        </g>
      ))}
      {charge !== undefined && <g data-micro-charge={charge}>
        <path d={`M${left + 4} ${top}H${left}V${bottom}H${left + 4} M${right - 4} ${top}H${right}V${bottom}H${right - 4}`}
          stroke="#64748b" strokeWidth="1.7" fill="none" />
        <text x={right + 4} y={top + 3} fontSize="17" fontWeight="700" fill="#0f172a">{formatIonCharge(charge)}</text>
      </g>}
    </svg>
  );
}

export const MicroDiagramSvg: React.FC<{ composition: SubstanceComposition }> = ({ composition }) => {
  const descriptionId = useId();
  const { title, description, tiles } = describeMicroDiagram(composition);
  const legend = buildMicroLegend(tiles.map(tile => tile.particle));
  const hasIons = composition.structureType === 'ionic' || composition.structureType === 'aqueous';
  const hasPerspective = tiles.some(tile => tile.particle.bonds.some(([, , style]) => style === 'away' || style === 'towards'));
  const notes = [
    hasIons && '每种离子只画一个，×数字表示个数比；括号右上角是整个离子的电荷。',
    composition.structureType === 'ionic' && '不表示晶格中的实际位置。',
    composition.structureType === 'aqueous' && '另画一个水分子表示溶剂，不表示实际含量、浓度或水合层。',
    hasPerspective && '实楔线朝向观察者，虚楔线背向观察者。',
    composition.note,
  ].filter(Boolean).join('');
  const caption = tiles.flatMap(({ name, count, charge }) => name
    ? [`${name}${charge === undefined ? '' : `（电荷 ${formatIonCharge(charge)}）`}${count === undefined ? '' : `，比例数 ${count}`}`] : []);

  return (
    <figure className="micro-diagram-card" data-testid="micro-diagram" data-structure-type={composition.structureType}>
      <figcaption className="micro-diagram-header">
        <span className="micro-badge">{title}</span>
        <span className="micro-desc" id={descriptionId}>{description}</span>
      </figcaption>
      <div className={`micro-graphic ${tiles.length > 1 ? 'has-tiles' : ''}`} role="img"
        aria-label={caption.length ? `${title}：${caption.join('；')}` : title} aria-describedby={descriptionId}>
        {tiles.map(({ particle, name, count, charge }, index) => (
          <div className="micro-tile" key={name ?? index} data-particle-count={count}>
            <ParticleSvg particle={particle} charge={charge} compact={tiles.length > 1} />
            {name && <div className="micro-tile-caption">
              <span>{name}</span>{count !== undefined && <strong>×{count}</strong>}
            </div>}
          </div>
        ))}
      </div>
      {notes && <p className="micro-note">{notes}</p>}
      <div className="micro-legend" aria-label="元素符号图例">
        {legend.map(item => (
          <span key={item.symbol} className="micro-legend-item">
            <span className="micro-legend-dot" style={{ backgroundColor: item.fill, borderColor: item.stroke }} />
            {item.label}
          </span>
        ))}
        <span className="micro-note">颜色仅用于区分元素；示意图不按实际大小、键长或键角比例绘制。</span>
      </div>
    </figure>
  );
};