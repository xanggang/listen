'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStationStore } from '@/app/store/useStationStore';

interface Props {
  coverColor?: string;
  isFavorite?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function PlayerCard({
  coverColor = 'var(--oc-gray-1)',
  isFavorite = false,
  isExpanded = true,
  onToggleExpand
}: Props) {
  const { currentStation, isPlaying, setIsPlaying } = useStationStore();
  const [isVolumeOn, setIsVolumeOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Implementation for favorite toggle
  };

  const handleToggleVolume = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVolumeOn(!isVolumeOn);
  };

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleWrapperClick = () => {
      // In Vue: @click="handleToggleExpand" was on the inner expanded div.
      if (isExpanded && onToggleExpand) {
          onToggleExpand();
      }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentStation?.url) {
      if (audio.src !== currentStation.url) {
        audio.src = currentStation.url;
      }
      console.log(isPlaying)
      if (isPlaying) {
        audio.play().catch(e => {
          console.error("Play error:", e);
          setIsPlaying(false);
        });
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [currentStation, isPlaying, setIsPlaying]);

  // Styles
  const wrapperBaseClasses = "absolute bottom-20 right-[2%] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-400 ease-in-out z-40 overflow-hidden";
  const expandedClasses = "w-[96%] h-24 bg-white dark:bg-gray-700 rounded-xl";
  // Fallback color added just in case variable is missing, but prefer variable
  const collapsedClasses = "w-12 h-12 rounded-full flex items-center justify-center";

  const renderExpandedView = () => (
    <div
      className="flex items-center p-3 h-full w-full cursor-pointer"
      onClick={handleWrapperClick}
    >
      {/* Cover */}
      <div
        className="mr-4 rounded-xl flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: coverColor }}
      >
        {currentStation?.favicon ? (
          <img src={currentStation.favicon} alt={currentStation.name} className="h-16 w-16 object-cover" />
        ) : (
          <div className="h-16 w-16 flex items-center justify-center text-white">
            <img src="/favicon.png" alt=""/>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 mr-2">
        <h3 className="font-medium text-black dark:text-white truncate text-lg leading-6">
          {currentStation?.name || 'No Station Selected'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-6">
          {currentStation?.country || '--'} • {currentStation?.language || '--'}
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>

        <button
          className="flex items-center justify-center text-white bg-[var(--primary-1, #10b981)] w-12 h-12 rounded-full"
          style={{ backgroundColor: 'var(--primary-1, #10b981)' }}
          onClick={handleTogglePlay}
          aria-label="Play/Pause"
        >
          {isPlaying ? (
            <div className="iconfont icon-zanting text-2xl"></div>
          ) : (
            <div className="iconfont icon-bofang text-2xl"></div>
          )}
        </button>

        {/*<div className="flex justify-center items-center space-x-2">*/}
        {/*  /!* Favorite *!/*/}
        {/*  <button*/}
        {/*    className="flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 text-xl w-8 h-8 rounded-full"*/}
        {/*    onClick={handleToggleFavorite}*/}
        {/*    aria-label="Favorite"*/}
        {/*  >*/}
        {/*    {!isFavorite ? (*/}
        {/*      <span className="iconfont icon-dianzan-xiankuang"></span>*/}
        {/*    ) : (*/}
        {/*      <span className="iconfont icon-dianzan-shixin text-[var(--primary-1, #10b981)]"></span>*/}
        {/*    )}*/}
        {/*  </button>*/}

        {/*  /!* Volume *!/*/}
        {/*  <button*/}
        {/*    className="flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 text-xl w-8 h-8 rounded-full"*/}
        {/*    onClick={handleToggleVolume}*/}
        {/*    aria-label="Volume"*/}
        {/*  >*/}
        {/*    {isVolumeOn ? (*/}
        {/*      <div className="iconfont icon-jingyin"></div>*/}
        {/*    ) : (*/}
        {/*      <div className="iconfont icon-yinliang"></div>*/}
        {/*    )}*/}
        {/*  </button>*/}
        {/*</div>*/}

        {/*<div className="flex justify-center items-center space-x-2">*/}
        {/*  /!* Play/Pause *!/*/}
        {/*  <button*/}
        {/*    className="flex items-center justify-center text-white bg-[var(--primary-1, #10b981)] w-8 h-8 rounded-full"*/}
        {/*    style={{ backgroundColor: 'var(--primary-1, #10b981)' }}*/}
        {/*    onClick={handleTogglePlay}*/}
        {/*    aria-label="Play/Pause"*/}
        {/*  >*/}
        {/*    {isPlaying ? (*/}
        {/*      <div className="iconfont icon-zanting text-xl"></div>*/}
        {/*    ) : (*/}
        {/*      <div className="iconfont icon-bofang text-xl"></div>*/}
        {/*    )}*/}
        {/*  </button>*/}

        {/*  /!* More *!/*/}
        {/*  <button*/}
        {/*    className="flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 text-xl w-8 h-8 rounded-full"*/}
        {/*    onClick={handleShowMore}*/}
        {/*    aria-label="More"*/}
        {/*  >*/}
        {/*    <div className="iconfont icon-danmushezhi"></div>*/}
        {/*  </button>*/}
        {/*</div>*/}
      </div>
    </div>
  );

  const renderCollapsedView = () => (
    <div
      className="w-12 h-12 flex items-center justify-center text-white rounded-full cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand?.();
      }}
    >
      {isPlaying ? (
        <div className="iconfont icon-zanting text-xl"></div>
      ) : (
        <div className="iconfont icon-bofang text-xl"></div>
      )}
    </div>
  );

  return (
    <>
      <div
        className={`${wrapperBaseClasses} ${isExpanded ? expandedClasses : collapsedClasses}`}
        style={!isExpanded ? { backgroundColor: 'var(--primary-1, #10b981)' } : {}}
      >
        {isExpanded ? renderExpandedView() : renderCollapsedView()}
      </div>
      <audio ref={audioRef} className="hidden" />
    </>
  );
}
