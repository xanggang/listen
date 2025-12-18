import type { Station } from '../types';
// import { formatNumber } from '@/utils/utils';
// import { Station } from '@/api';
// Assuming you use a hook-based store like Zustand or Redux for player state
// import { usePlayerStore } from '@/stores/playerStore';


const LeaderboardItem = ({ item }: { item: Station}) => {
  // const handlePlayerStation = usePlayerStore((state) => state.handlePlayerStation);
  const handlePlay = (e: React.MouseEvent) => {
    // Stop propagation if clicking the button shouldn't trigger parent div events
    e.stopPropagation();
    // handlePlayerStation(item);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle favorite logic
    console.log('Favorite toggled for', item.name);
  };

  return (
    <div className="flex items-center p-3 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl cursor-pointer">
      {/* Station Logo */}
      <div className="w-16 h-16 rounded-xl mr-4 flex-shrink-0">
        {item.favicon && (
          <img
            src={item.favicon}
            alt={item.name}
            className="w-full h-full object-cover rounded-full"
          />
        )}
      </div>

      {/* Station Info */}
      <div className="flex-grow min-w-0">
        <h3 className="font-bold text-black dark:text-white leading-6 text-lg truncate text-left">
          {item.name}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-5 text-left">
          {item.country} / {item.language} /  { item.votes }
        </p>
      </div>

      {/* Votes and Action */}
      <div className="text-right flex items-center flex-shrink-0 gap-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-gray-600 active:scale-90 transition-transform"
          onClick={handleFavorite}
        >
          <span className="iconfont icon-dianzan-xiankuang text-xl text-black dark:text-white"></span>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-gray-600 active:scale-90 transition-transform"
          onClick={handlePlay}
        >
          <span className="iconfont icon-bofang text-2xl text-black dark:text-white"></span>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardItem;
