import React from 'react';
import { Calendar, Link as LinkIcon, CheckCircle2, Clock } from 'lucide-react';

interface RightPanelProps {
  isOpen: boolean;
}

const RightPanel: React.FC<RightPanelProps> = ({ isOpen }) => {
  return (
    <aside 
      className={`
        h-full bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-xl flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 overflow-hidden'}
      `}
    >
      <div className="w-80 h-full flex flex-col p-6 pt-8 overflow-y-auto">
        <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-wide uppercase mb-4 opacity-40">Context</h2>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100/50 dark:border-gray-700/50 mb-4 transition-colors">
                <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 font-medium">
                    <LinkIcon size={14} className="text-blue-500" />
                    <span className="text-xs">Linked Mentions</span>
                </div>
                <div className="space-y-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer transition-colors">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Project Alpha</span> referenced this note.
                        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">2 days ago</div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer transition-colors">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Weekly Sync</span> referenced this note.
                        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">5 days ago</div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100/50 dark:border-gray-700/50 mb-4 transition-colors">
                <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 font-medium">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="text-xs">Tasks</span>
                </div>
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-black dark:accent-white rounded-sm" defaultChecked />
                        <span className="text-xs text-gray-400 dark:text-gray-500 line-through">Review design mocks</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-black dark:accent-white rounded-sm" />
                        <span className="text-xs text-gray-600 dark:text-gray-300">Sync with engineering</span>
                    </div>
                </div>
            </div>
        </div>

        <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-wide uppercase mb-4 opacity-40">Calendar</h2>
             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100/50 dark:border-gray-700/50 transition-colors">
                <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-gray-200 font-medium">
                    <Calendar size={14} className="text-purple-500" />
                    <span className="text-xs">Upcoming</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[12, 13, 14, 15].map((day, i) => (
                        <div key={day} className={`flex-shrink-0 w-10 h-12 rounded-lg flex flex-col items-center justify-center border ${i === 0 ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}>
                            <span className="text-[10px] font-bold">OCT</span>
                            <span className="text-xs font-medium">{day}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                        <span>2:00 PM - Deep Work Session</span>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </aside>
  );
};

export default RightPanel;