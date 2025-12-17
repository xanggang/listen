import type { Station } from '../types';
// import { formatNumber } from '@/utils/utils';
// import { Station } from '@/api';
// Assuming you use a hook-based store like Zustand or Redux for player state
// import { usePlayerStore } from '@/stores/playerStore';


const LeaderboardItem = ({ item }: { item: Station}) => {
  // const handlePlayerStation = usePlayerStore((state) => state.handlePlayerStation);
  console.log(item)

  const handlePlay = (e: React.MouseEvent) => {
    // Stop propagation if clicking the button shouldn't trigger parent div events
    e.stopPropagation();
    // handlePlayerStation(item);
  };

  return (
    <div className="flex items-center p-3 bg-white border border-gray-100 rounded-2xl  cursor-pointer">
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
      <div className="flex-grow">
        <h3 className="font-bold text-black leading-6 text-xl break-words text-left">
          {item.name}
        </h3>
        <p className="text-sm text-gray-700 leading-5 text-lg text-left">
          {item.country} • {item.language}
        </p>
      </div>

      {/* Votes and Action */}
      <div className="text-right flex items-center flex-shrink-0">
        <div className="font-bold text-black mr-3">
          { item.votes }
        </div>

      </div>
    </div>
  );
};

export default LeaderboardItem;
