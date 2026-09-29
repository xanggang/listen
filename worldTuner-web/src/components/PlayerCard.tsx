'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useStationStore } from '@/app/store/useStationStore';
import { useLibraryStore } from '@/app/store/useLibraryStore';

/** 常驻胶囊播放器与唯一 audio 元素保持同步，空状态也占位。 */
export default function PlayerCard() {
  const { currentStation, isPlaying, setIsPlaying } = useStationStore();
  const favorite = useLibraryStore(
    /** 仅订阅当前电台是否在浏览器收藏列表中。 */
    (state) => state.favorites.some((station) => station.id === currentStation?.id),
  );
  const toggleFavorite = useLibraryStore(
    /** 只订阅本地收藏动作。 */
    (state) => state.toggleFavorite,
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackVersion = useRef(0);
  const [audioError, setAudioError] = useState(false);
  const locale = useLocale();

  useEffect(
    /** 首次挂载后恢复本地电台与收藏，避免服务端和客户端首帧内容不同。 */
    () => {
      void Promise.allSettled([
        useStationStore.persist.rehydrate(),
        useLibraryStore.persist.rehydrate(),
      ]);
    },
    [],
  );

  useEffect(
    /** 电台或播放状态改变时更新音频源；失败时退回暂停状态。 */
    () => {
      const audio = audioRef.current;
      if (!audio) return;
      const version = ++playbackVersion.current;
      const source = currentStation?.urlResolved || currentStation?.url;
      if (!source) {
        audio.pause();
        audio.removeAttribute('src');
        return;
      }
      if (audio.src !== source) {
        audio.src = source;
        setAudioError(false);
      }
      if (isPlaying) {
        setAudioError(false);
        void audio.play().catch(
          /** 浏览器拦截或流不可用时停止播放，不显示虚假的播放态。 */
          () => {
            if (version !== playbackVersion.current) return;
            setAudioError(true);
            setIsPlaying(false);
          },
        );
      } else {
        audio.pause();
      }
    },
    [currentStation, isPlaying, setIsPlaying],
  );

  // 音频开始后才发生的流媒体错误也会停止播放并展示提示。
  function handleAudioError() {
    if (!currentStation) return;
    setAudioError(true);
    setIsPlaying(false);
  }

  // 有结束事件的流媒体在结束后同步退出播放态。
  function handleAudioEnded() {
    setIsPlaying(false);
  }

  return (
    <div className="player-dock" role="region" aria-label={locale === 'zh' ? '播放器' : 'Player'}>
      <div className="player-dock__art">
        {currentStation?.favicon ? (
          <img src={currentStation.favicon} alt="" onError={
            /** 坏链接时隐藏图片，保留底色。 */
            (event) => { event.currentTarget.style.display = 'none'; }
          } />
        ) : (
          <span className="iconfont icon-bofang" aria-hidden="true" />
        )}
      </div>
      <div className="player-dock__info">
        <div className="player-dock__name">
          {currentStation?.name || (locale === 'zh' ? '尚未选择电台' : 'No station selected')}
        </div>
        <div className="player-dock__meta" aria-live="polite">
          {audioError
            ? (locale === 'zh' ? '音频播放失败' : 'Audio unavailable')
            : currentStation?.country || (locale === 'zh' ? '探索世界的声音' : 'Explore sounds worldwide')}
        </div>
      </div>
      <button
        type="button"
        className="player-dock__favorite"
        disabled={!currentStation}
        aria-label={favorite ? (locale === 'zh' ? '取消收藏' : 'Remove favorite') : (locale === 'zh' ? '收藏' : 'Favorite')}
        aria-pressed={favorite}
        onClick={
          /** 胶囊播放器收藏当前电台，仅写入本机。 */
          () => { if (currentStation) toggleFavorite(currentStation); }
        }
      >
        {favorite ? '♥' : '♡'}
      </button>
      <button
        type="button"
        className="player-dock__play"
        disabled={!currentStation}
        aria-label={isPlaying ? (locale === 'zh' ? '暂停' : 'Pause') : (locale === 'zh' ? '播放' : 'Play')}
        onClick={
          /** 仅切换当前电台的播放状态。 */
          () => setIsPlaying(!isPlaying)
        }
      >
        <span className={`iconfont ${isPlaying ? 'icon-zanting' : 'icon-bofang'}`} aria-hidden="true" />
      </button>
      <audio ref={audioRef} preload="none" onError={handleAudioError} onEnded={handleAudioEnded} />
    </div>
  );
}
