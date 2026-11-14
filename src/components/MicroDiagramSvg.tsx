import React from 'react';
import { buildMicroLegend, getAtomStyle } from '../modules/knowledge/microDiagram';
import { SubstanceComposition } from '../types/chemistry';

interface MicroDiagramSvgProps {
  composition: SubstanceComposition;
}

export const MicroDiagramSvg: React.FC<MicroDiagramSvgProps> = ({ composition }) => {
  const legend = buildMicroLegend(composition);

  const nodes: { symbol: string; charge?: string; role?: string; key: string }[] = [];
  composition.atoms.forEach((spec, idx) => {
    for (let i = 0; i < spec.count; i++) {
      nodes.push({
        symbol: spec.symbol,
        charge: spec.charge,
        role: spec.role,
        key: `${spec.symbol}-${idx}-${i}`,
      });
    }
  });

  return (
    <div className="micro-diagram-card">
      <div className="micro-diagram-header">
        <span className="micro-badge">
          {composition.structureType === 'molecule'
            ? '分子构成示意图'
            : composition.structureType === 'ionic'
            ? '离子构成比例示意图'
            : '原子直接构成示意图'}
        </span>
        <span className="micro-desc">{composition.unitDescription}</span>
      </div>

      <svg
        viewBox="0 0 360 150"
        className="micro-svg"
        role="img"
        aria-label="物质微观构成线索示意图"
      >
        <rect width="360" height="150" rx="12" fill="#f8fafc" stroke="#e2e8f0" />

        {composition.structureType === 'molecule' && <MoleculeLayout nodes={nodes} />}
        {composition.structureType === 'ionic' && <IonicLayout nodes={nodes} />}
        {(composition.structureType === 'metallic' ||
          composition.structureType === 'network_atom') && (
          <LatticeLayout symbol={nodes[0]?.symbol ?? 'X'} />
        )}
      </svg>

      <div className="micro-legend" aria-label="微观粒子图例">
        {legend.map((item) => (
          <div key={item.label} className="micro-legend-item">
            <span
              className="micro-legend-dot"
              style={{ backgroundColor: item.fill, borderColor: item.stroke }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface NodeItem {
  symbol: string;
  charge?: string;
  role?: string;
  key: string;
}

const MoleculeLayout: React.FC<{ nodes: NodeItem[] }> = ({ nodes }) => {
  if (nodes.length === 1) {
    const style = getAtomStyle(nodes[0].symbol);
    return (
      <g transform="translate(180, 75)">
        <circle r={style.radius + 4} fill={style.fill} stroke={style.stroke} strokeWidth="2.5" />
        <text textAnchor="middle" dy="6" fontSize="16" fontWeight="700" fill={style.textColor}>
          {nodes[0].symbol}
        </text>
      </g>
    );
  }

  if (nodes.length === 2) {
    const s0 = getAtomStyle(nodes[0].symbol);
    const s1 = getAtomStyle(nodes[1].symbol);
    return (
      <g>
        <line x1="148" y1="75" x2="212" y2="75" stroke="#64748b" strokeWidth="5" />
        <g transform="translate(148, 75)">
          <circle r={s0.radius + 2} fill={s0.fill} stroke={s0.stroke} strokeWidth="2.5" />
          <text textAnchor="middle" dy="5" fontSize="15" fontWeight="700" fill={s0.textColor}>
            {nodes[0].symbol}
          </text>
        </g>
        <g transform="translate(212, 75)">
          <circle r={s1.radius + 2} fill={s1.fill} stroke={s1.stroke} strokeWidth="2.5" />
          <text textAnchor="middle" dy="5" fontSize="15" fontWeight="700" fill={s1.textColor}>
            {nodes[1].symbol}
          </text>
        </g>
      </g>
    );
  }

  const centerIdx = nodes.findIndex((n) => n.role === 'center');
  const centerNode = centerIdx >= 0 ? nodes[centerIdx] : nodes[0];
  const ligands = nodes.filter((_, i) => i !== (centerIdx >= 0 ? centerIdx : 0));

  const cx = 180;
  const cy = 76;
  const centerStyle = getAtomStyle(centerNode.symbol);

  const angles =
    ligands.length === 2
      ? [-145, -35]
      : ligands.length === 3
      ? [-90, 30, 150]
      : ligands.length === 4
      ? [-135, -45, 45, 135]
      : ligands.map((_, i) => (360 / ligands.length) * i - 90);

  return (
    <g>
      {ligands.map((lig, i) => {
        const rad = (angles[i] * Math.PI) / 180;
        const dist = 50;
        const lx = cx + Math.cos(rad) * dist;
        const ly = cy + Math.sin(rad) * dist;
        const lStyle = getAtomStyle(lig.symbol);
        return (
          <g key={lig.key}>
            <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="#64748b" strokeWidth="4" />
            <circle cx={lx} cy={ly} r={lStyle.radius - 1} fill={lStyle.fill} stroke={lStyle.stroke} strokeWidth="2" />
            <text x={lx} y={ly + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={lStyle.textColor}>
              {lig.symbol}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={centerStyle.radius + 2} fill={centerStyle.fill} stroke={centerStyle.stroke} strokeWidth="2.5" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={centerStyle.textColor}>
        {centerNode.symbol}
      </text>
    </g>
  );
};

const IonicLayout: React.FC<{ nodes: NodeItem[] }> = ({ nodes }) => {
  const count = nodes.length;
  const spacing = Math.min(54, 290 / Math.max(count, 1));
  const startX = 180 - ((count - 1) * spacing) / 2;

  return (
    <g>
      {nodes.map((node, i) => {
        const x = startX + i * spacing;
        const y = 76;
        const style = getAtomStyle(node.symbol);
        const r = Math.min(style.radius, 22);
        return (
          <g key={node.key} transform={`translate(${x}, ${y})`}>
            <circle r={r} fill={style.fill} stroke={style.stroke} strokeWidth="2" />
            <text textAnchor="middle" dy="5" fontSize="13" fontWeight="700" fill={style.textColor}>
              {node.symbol}
            </text>
            {node.charge && (
              <text x={r - 2} y={-r + 6} fontSize="10" fontWeight="700" fill="#1e293b">
                {node.charge}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

const LatticeLayout: React.FC<{ symbol: string }> = ({ symbol }) => {
  const style = getAtomStyle(symbol);
  const positions = [
    [136, 54],
    [180, 54],
    [224, 54],
    [158, 96],
    [202, 96],
  ];

  return (
    <g>
      {positions.map(([x, y], idx) => (
        <g key={idx} transform={`translate(${x}, ${y})`}>
          <circle r="19" fill={style.fill} stroke={style.stroke} strokeWidth="2" />
          <text textAnchor="middle" dy="5" fontSize="13" fontWeight="700" fill={style.textColor}>
            {symbol}
          </text>
        </g>
      ))}
    </g>
  );
};
