import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureBlob: (blob: Blob, fileName: string) => void;
  onFallbackUpload: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCaptureBlob,
  onFallbackUpload,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraError(null);
      return;
    }

    let cancelled = false;
    async function startCamera() {
      setIsStarting(true);
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsStarting(false);
        setCameraError('当前浏览器不支持直接调用摄像头，请改用本地图片上传。');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setCameraError('未获得摄像头权限或设备无可用相机，已为你保留本地图片上传入口。');
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        onCaptureBlob(blob, `camera-${Date.now()}.png`);
        onClose();
      }
    }, 'image/png');
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <h3 id="camera-modal-title">拍照识物</h3>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="关闭拍照窗口">
            关闭
          </button>
        </div>

        {isStarting && <p className="status-banner is-info">正在请求打开摄像头...</p>}

        {cameraError ? (
          <div className="camera-fallback-box">
            <p className="status-banner is-warn">{cameraError}</p>
            <div className="action-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onFallbackUpload();
                }}
              >
                改用本地上传图片
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                返回
              </button>
            </div>
          </div>
        ) : (
          <div className="camera-stage">
            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
            <div className="action-row">
              <button type="button" className="btn-primary" onClick={handleTakeSnapshot}>
                立即拍照
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onClose();
                  onFallbackUpload();
                }}
              >
                改用本地图片上传
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
