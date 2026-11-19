import type { DemoSample, SubstanceEntry } from '../types/chemistry';
import { formatFormulaPreview } from '../modules/formula/parser';
import { SampleIllustration } from './SampleIllustration';

interface PreviewProps {
  sample?: DemoSample;
  imageUrl: string | null;
  fileName: string | null;
  substance?: SubstanceEntry;
  verified: boolean;
  onCamera: () => void;
  onUpload: () => void;
  onReset: () => void;
}

export function StudyPreview({ sample, imageUrl, fileName, substance, verified, onCamera, onUpload, onReset }: PreviewProps) {
  return <aside className="study-sidebar" aria-label="当前学习对象状态">
    <div className="card sidebar-card">
      <div className="sidebar-card-head">
        <h3>当前图片预览</h3>
        <div className="sidebar-mini-actions">
          <button type="button" className="btn-ghost btn-xs" onClick={onCamera}>重拍</button>
          <button type="button" className="btn-ghost btn-xs" onClick={onUpload}>换图</button>
          <button type="button" className="btn-ghost btn-xs" onClick={onReset}>换样例</button>
        </div>
      </div>
      {sample ? <SampleIllustration svgKind={sample.svgKind} compact/> : imageUrl ? <div className="uploaded-preview-box">
        <img src={imageUrl} alt={fileName ?? '用户上传的图片预览'} className="uploaded-preview-img"/>
        <div className="sample-caption">本地图片预览（仅当前会话内存保存）</div>
      </div> : <div className="empty-preview-box">暂无图片</div>}
      <div className="sidebar-status-box">
        <div className="sidebar-status-row"><span className="status-label">已确认名称：</span><strong className="status-val">{substance?.name ?? '尚未确认'}</strong></div>
        <div className="sidebar-status-row">
          <span className="status-label">化学式状态：</span>
          {substance && verified ? <strong className="status-val is-unlocked-text" data-testid="sidebar-formula-revealed">{formatFormulaPreview(substance.formula)}（已解锁）</strong>
            : <span className={`status-val ${substance ? 'is-locked-text' : 'is-muted-text'}`}>{substance ? '待推导书写（解锁后显示）' : '—'}</span>}
        </div>
      </div>
    </div>
  </aside>;
}
