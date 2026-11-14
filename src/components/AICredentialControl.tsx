import React, { useState } from 'react';
import { canUseServerCredential, updateOnlineAIConfig } from '../modules/recognition/aiConfig';
import { OnlineAIConfig } from '../types/chemistry';
import { IS_STATIC_HOSTING } from '../modules/recognition/defaults';

interface AICredentialControlProps {
  config: OnlineAIConfig;
  inputId: string;
  onChange: (next: OnlineAIConfig) => void;
}

/** 首页和设置弹窗共享凭据交互，默认 Key 从不传入该组件。 */
export const AICredentialControl: React.FC<AICredentialControlProps> = ({ config, inputId, onChange }) => {
  const [showKey, setShowKey] = useState(false);
  return (
    <div className="form-field">
      <label htmlFor={`${inputId}-source`}>连接凭据</label>
      <select
        id={`${inputId}-source`}
        value={config.credentialSource}
        onChange={(e) => onChange(updateOnlineAIConfig(config, {
          credentialSource: e.target.value as OnlineAIConfig['credentialSource'],
          apiKey: e.target.value === 'server' ? '' : config.apiKey,
        }))}
      >
        <option value="server" disabled={!canUseServerCredential(config)}>
          {IS_STATIC_HOSTING ? '内置默认 Key（静态网页不可用）' : '内置默认 Key（本机服务端保管）'}
        </option>
        <option value="session">自备 API Key（仅当前标签页）</option>
      </select>
      {config.credentialSource === 'server' ? (
        <p className="settings-desc" data-testid={`${inputId}-server-notice`}>
          已使用内置 DeepSeek V4.1 Flash 连接，无需填写 Key。默认密钥仅在本机 .env.local 中，浏览器无法查看；需要通过本机 dev/preview 服务使用。
        </p>
      ) : (
        <>
          <label htmlFor={inputId}>自备 API Key（仅存 sessionStorage）</label>
          <div className="key-input-wrap">
            <input
              id={inputId}
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => onChange(updateOnlineAIConfig(config, { apiKey: e.target.value }))}
              placeholder="输入与你所选接口匹配的 API Key"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="btn-ghost btn-xs" onClick={() => setShowKey((value) => !value)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
