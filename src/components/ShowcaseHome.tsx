import React from 'react';
import { DEMO_SAMPLES } from '../data/samples';
import { IS_STATIC_HOSTING } from '../modules/recognition/defaults';
import type { DemoSample } from '../types/chemistry';
import { SampleIllustration } from './SampleIllustration';
import { ShowcaseIcon } from './ShowcaseIcon';

const featuredIndex = DEMO_SAMPLES.findIndex(sample => sample.svgKind === 'limestone_rock');
const plateNo = (index: number) => String(index + 1).padStart(2, '0');

/** 原创标本插画，只作课堂封面；名称来自已有标签样例，不是识图结果或实测数据。 */
function LimestonePlate() {
  return <figure className="specimen-plate" aria-label="石灰石标本示意插画，非真实照片">
    <div className="plate-topline"><span>SPECIMEN PLATE</span><span>图版 {plateNo(featuredIndex)}</span></div>
    <svg className="plate-art" viewBox="0 0 380 214" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="limestone-lit" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#fff6da"/><stop offset="1" stopColor="#b8c7ae"/></linearGradient>
        <pattern id="limestone-grain" width="9" height="8" patternUnits="userSpaceOnUse"><path d="m1 3 2-.5m3 4 1.4-.7" stroke="#435e51" strokeWidth=".8" opacity=".58"/></pattern>
        <pattern id="limestone-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M1 0v5" stroke="#314f45" strokeWidth="1" opacity=".55"/></pattern>
      </defs>
      <g fill="none" stroke="#adc9b8" strokeWidth=".8" opacity=".55"><ellipse cx="191" cy="163" rx="145" ry="29" strokeDasharray="2 5"/><path d="M24 171h34m-17-5v10"/></g>
      <ellipse cx="195" cy="166" rx="104" ry="12" fill="#081e1e" opacity=".48"/>
      <g strokeLinejoin="round" strokeWidth="1.2" stroke="#9bad98">
        <path d="m66 132 18-40 47-35 22-4 26-18 45 6 34 23 25 5 23 45-10 34-40 24-61 5-38-8-42-1-34-15Z" fill="url(#limestone-lit)"/>
        <path d="m66 132 18-40 47-35-13 39-28 28 20 24-29 5Z" fill="#9fae98"/>
        <path d="m118 96 13-39 22-4 26-18 45 6-37 30-24 8-22 25Z" fill="#f6ecd2"/>
        <path d="m141 104 22-25 24-8 37-30 34 23-28 13-21 30-42 10Z" fill="#ced6be"/>
        <path d="m230 77 28-13 25 5 23 45-32-3-32 14-33-18Z" fill="#b2bea6"/>
        <path d="m90 124 28-28 23 8 26 13-19 19-38 12Z" fill="#dce0c8"/>
        <path d="m110 148 38-12 19-19 42-10 33 18-28 20-44 10-13 14-42-1-34-15Z" fill="#a4b39b"/>
        <path d="m157 169 13-14 44-10 28-20 32-14 32 3-10 34-40 24-61 5Z" fill="#7f9684"/>
        <path d="m157 169 13-14 44-10 28-20 32-14 32 3-10 34-40 24-61 5Z" fill="url(#limestone-hatch)" stroke="none"/>
        <path d="m66 132 18-40 47-35 22-4 26-18 45 6 34 23 25 5 23 45-10 34-40 24-61 5-38-8-42-1-34-15Z" fill="url(#limestone-grain)" stroke="#d5deca"/>
      </g>
      <g fill="none" stroke="#f6ecd5" strokeLinecap="round"><path d="m105 120 23-7 19 1 14-8 22-1 14-9 20 1 19-8" strokeWidth="2.2"/><path d="m133 146 16-5 20-13 21-4 12-8 17-2m-78-42 13-8 13 1 11-7" opacity=".85"/></g>
      <g fill="none" stroke="#dbb77a" strokeWidth="1"><circle cx="250" cy="91" r="3"/><path d="m253 89 27-35h47"/></g>
      <text x="282" y="49" fill="#e8dbba" fontSize="10">纹理示意</text>
    </svg>
    <figcaption><div><small>岩石标本</small><strong>石灰石</strong></div><span>示意插画 · 非实物照片</span></figcaption>
  </figure>;
}

interface HomeProps {
  onSelectSample: (sample: DemoSample) => void;
  onCamera: () => void;
  onUpload: () => void;
  children: React.ReactNode;
}

export function ShowcaseHome({ onSelectSample, onCamera, onUpload, children }: HomeProps) {
  return <div className="home-layout">
    <section className="atlas-cover" aria-labelledby="cover-title">
      <div className="cover-copy">
        <p className="atlas-kicker cover-kicker">初中化学 <i aria-hidden="true"/> 课堂观察手册</p>
        <h1 id="cover-title" aria-label="从一张照片，认识一种物质">从一张照片，<em>认识一种物质</em></h1>
        <p className="cover-deck">先读标签，再用元素质量比推导化学式。<br/>把一次观察，变成一堂有证据的化学课。</p>
        <div className="cover-actions">
          <button type="button" className="cover-primary" onClick={() => onSelectSample(DEMO_SAMPLES[featuredIndex])}>从石灰石样例开始 <ShowcaseIcon name="arrow"/></button>
          <button type="button" className="cover-action" onClick={onCamera}><ShowcaseIcon name="camera"/>拍照识物</button>
          <button type="button" className="cover-action" onClick={onUpload}><ShowcaseIcon name="upload"/>上传图片</button>
        </div>
        <p className="cover-note">样例无需 Key。{IS_STATIC_HOSTING ? '在线识图需自备 Key，图片经授权才发送。' : '在线识图发送图片前需授权。'}</p>
      </div>
      <LimestonePlate/>
    </section>

    <section className="samples-section" aria-labelledby="samples-heading">
      <div className="collection-heading">
        <div><p className="atlas-kicker">图鉴索引 <i aria-hidden="true"/> FIELD COLLECTION</p><h2 id="samples-heading">课堂样例</h2></div>
        <p>从标签、矿石或实验桌出发。<br/>任选一张图版，无需上传照片。</p>
      </div>
      <div className="samples-grid">
        {DEMO_SAMPLES.map((sample, index) => <article key={sample.id} className="sample-card">
          <div className="sample-mat"><span className="plate-index" aria-hidden="true">FIG. {plateNo(index)}</span><SampleIllustration svgKind={sample.svgKind} compact/></div>
          <div className="sample-card-body">
            <span className="sample-badge">{sample.categoryBadge}</span>
            <h3>{sample.title.replace(/^场景 [^：]+：/, '')}</h3><p>{sample.description}</p>
            <button type="button" className="sample-start" onClick={() => onSelectSample(sample)}>使用此样例开始学习 <ShowcaseIcon name="arrow"/></button>
          </div>
        </article>)}
      </div>
    </section>
    {children}
  </div>;
}
