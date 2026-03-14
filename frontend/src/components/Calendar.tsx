'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { calendarAPI, cropsAPI } from '@/lib/api';
import { Calendar as CalendarIcon, Plus, CheckCircle, Clock, ArrowRight, Sprout, Droplets, Sun, Scissors, Truck, Bug, CalendarDays, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const ACTIVITY_ICONS: Record<string, typeof Sprout> = {
  planting: Sprout,
  irrigation: Droplets,
  fertilization: Sun,
  pest_control: Bug,
  harvesting: Truck,
  pruning: Scissors,
  weeding: Scissors,
};
const ACTIVITY_COLORS: Record<string, string> = {
  planting: 'bg-green-100 text-green-700',
  irrigation: 'bg-sky-100 text-sky-700',
  fertilization: 'bg-amber-100 text-amber-700',
  pest_control: 'bg-rose-100 text-rose-700',
  harvesting: 'bg-red-100 text-red-700',
  pruning: 'bg-violet-100 text-violet-700',
  weeding: 'bg-lime-100 text-lime-700',
};

export default function Calendar() {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();
  const [calendars, setCalendars] = useState<any[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCalendar, setNewCalendar] = useState({
    cropId: '',
    plantingDate: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [addForCalendarId, setAddForCalendarId] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({
    type: 'irrigation',
    name: '',
    description: '',
    scheduledDate: '',
    priority: 'medium',
  });

  const loadCalendars = async () => {
    if (!state.isAuthenticated) return;
    
    setIsLoading(true);
    try {
      const [calendarsResponse, activitiesResponse] = await Promise.all([
        calendarAPI.getAll(),
        calendarAPI.getUpcomingActivities(30, state.selectedLanguage),
      ]);
      setCalendars(calendarsResponse.calendars);
      setUpcomingActivities(activitiesResponse.activities);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCrops = async () => {
    try {
      const cropsResponse = await cropsAPI.getAll({ language: state.selectedLanguage });
      dispatch({ type: 'SET_CROPS', payload: cropsResponse.crops });
    } catch (error) {
      console.error('Failed to load crops:', error);
    }
  };

  useEffect(() => {
    loadCrops();
    loadCalendars();
  }, [state.isAuthenticated, state.selectedLanguage]);

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalendar.cropId || !newCalendar.plantingDate) return;

    try {
      await calendarAPI.create({
        ...newCalendar,
        language: state.selectedLanguage,
      });
      setNewCalendar({ cropId: '', plantingDate: '' });
      setShowCreateForm(false);
      loadCalendars();
    } catch (error) {
      console.error('Failed to create calendar:', error);
    }
  };

  const handleDeleteCalendar = async (calendarId: string, cropName: string) => {
    if (!window.confirm(`Remove "${cropName}" from your calendar? This cannot be undone.`)) return;
    setDeletingId(calendarId);
    try {
      await calendarAPI.delete(calendarId);
      loadCalendars();
    } catch (error) {
      console.error('Failed to delete calendar:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkCompleted = async (calendarId: string, activityId: string) => {
    setCompleting(activityId);
    try {
      await calendarAPI.updateActivity(calendarId, activityId, {
        status: 'completed',
        completedDate: new Date().toISOString(),
      });
      await loadCalendars();
    } catch (error) {
      console.error('Failed to update activity:', error);
    } finally {
      setCompleting(null);
    }
  };

  const handleAddActivity = async (calendarId: string) => {
    if (!newActivity.name || !newActivity.scheduledDate) return;
    try {
      await calendarAPI.addActivity(calendarId, {
        type: newActivity.type as any,
        name: newActivity.name,
        description: newActivity.description,
        scheduledDate: new Date(newActivity.scheduledDate).toISOString(),
        priority: newActivity.priority as any,
      });
      setNewActivity({ type: 'irrigation', name: '', description: '', scheduledDate: '', priority: 'medium' });
      setAddForCalendarId(null);
      await loadCalendars();
    } catch (error) {
      console.error('Failed to add activity:', error);
    }
  };

  const handleDeleteActivity = async (calendarId: string, activityId: string, activityName: string) => {
    if (!window.confirm(`Delete activity "${activityName}"?`)) return;
    setDeletingId(activityId);
    try {
      await calendarAPI.deleteActivity(calendarId, activityId);
      await loadCalendars();
    } catch (error) {
      console.error('Failed to delete activity:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysFromNow = (dateString: string) => {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Build flow from actual calendar activities (crop-specific duration from backend)
  const getFarmingFlowFromCalendar = (calendar: any) => {
    const list = calendar?.activities || [];
    if (list.length === 0 && calendar?.plantingDate) {
      const planting = new Date(calendar.plantingDate);
      const days = calendar.maturityPeriodDays ?? 120;
      return [
        { id: 'planting', name: 'Planting', type: 'planting', date: planting, status: 'pending' },
        { id: 'harvest', name: 'Harvest', type: 'harvesting', date: new Date(planting.getTime() + days * 24 * 60 * 60 * 1000), status: 'pending' },
      ];
    }
    return list
      .map((a: any, i: number) => ({
        id: a._id || `a-${i}`,
        name: a.name,
        type: a.type || 'planting',
        date: new Date(a.scheduledDate),
        status: a.status || 'pending',
        description: a.description,
      }))
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
  };

  const getActivityIcon = (type: string) => ACTIVITY_ICONS[type] || Clock;
  const getActivityColor = (type: string) => ACTIVITY_COLORS[type] || 'bg-gray-100 text-gray-600';

  // Flow node for one activity (from API: type, date, status)
  const FlowNode = ({ activity, isLast }: { activity: any; isLast: boolean }) => {
    const IconComponent = getActivityIcon(activity.type);
    const colorClass = getActivityColor(activity.type);
    const isCompleted = activity.status === 'completed';
    const isOverdue = !isCompleted && new Date() > activity.date;
    const days = getDaysFromNow(activity.date?.toISOString?.() || activity.date);
    const isUpcoming = days > 0 && days <= 7;
    const isToday = days === 0;

    return (
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 min-w-[140px] ${
          isCompleted ? 'bg-green-50 border-green-200 shadow-md' 
            : isOverdue ? 'bg-red-50 border-red-200 shadow-md' 
            : isToday ? 'bg-amber-50 border-amber-300 shadow-md ring-2 ring-amber-200'
            : isUpcoming ? 'bg-sky-50 border-sky-200 shadow-sm' 
            : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 mx-auto ${colorClass}`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <h4 className="font-semibold text-sm text-gray-800 text-center mb-0.5 leading-tight">
            {activity.name}
          </h4>
          <p className="text-xs text-gray-500 text-center">
            {formatDate(activity.date?.toISOString?.() || activity.date)}
          </p>
          <div className="mt-2 flex justify-center">
            {isCompleted ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : isOverdue ? (
              <span className="text-xs font-medium text-red-600">{Math.abs(days)}d overdue</span>
            ) : isToday ? (
              <span className="text-xs font-medium text-amber-600">Today</span>
            ) : isUpcoming ? (
              <span className="text-xs font-medium text-sky-600">In {days} days</span>
            ) : (
              <div className="w-5 h-5 bg-gray-300 rounded-full" />
            )}
          </div>
        </div>
        {!isLast && (
          <div className="flex items-center justify-center my-4 flex-shrink-0">
            <ArrowRight className="w-5 h-5 text-gray-300" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-br from-green-50 to-white border border-green-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Farming Calendar</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Crop-specific timelines · Irrigation, fertilizing, harvest by crop
              </p>
            </div>
          </div>
          {state.isAuthenticated && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center space-x-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Crop</span>
            </button>
          )}
        </div>
      </div>

      {/* Create Calendar Form */}
      {showCreateForm && state.isAuthenticated && (
        <div className="card border border-green-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Add New Crop to Calendar</h3>
          <p className="text-sm text-gray-500 mb-4">Harvest duration is set per crop (e.g. Rice ~120 days, Tomato ~90 days).</p>
          <form onSubmit={handleCreateCalendar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Crop
                </label>
                <select
                  value={newCalendar.cropId}
                  onChange={(e) => setNewCalendar({ ...newCalendar, cropId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Choose a crop</option>
                  {state.crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planting Date
                </label>
                <input
                  type="date"
                  value={newCalendar.plantingDate}
                  onChange={(e) => setNewCalendar({ ...newCalendar, plantingDate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                Create Calendar
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Activities */}
      {upcomingActivities.length > 0 && (
        <div className="card border border-sky-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-600" />
            {t('upcomingActivities')}
          </h3>
          
          <div className="overflow-x-auto">
            <div className="flex items-start gap-3 min-w-max pb-4">
              {upcomingActivities.slice(0, 8).map((activity: any, index: number) => {
                const isOverdue = getDaysFromNow(activity.scheduledDate) < 0;
                const isToday = getDaysFromNow(activity.scheduledDate) === 0;
                const isUpcoming = getDaysFromNow(activity.scheduledDate) > 0 && getDaysFromNow(activity.scheduledDate) <= 7;
                const type = activity.type || 'planting';
                const ActivityIcon = getActivityIcon(type);
                const colorClass = getActivityColor(type);
                
                return (
                  <div key={index} className="flex flex-col items-center flex-shrink-0">
                    <div className={`relative p-4 rounded-2xl border-2 transition-all min-w-[120px] ${
                      isOverdue ? 'bg-red-50 border-red-200' 
                        : isToday ? 'bg-amber-50 border-amber-200' 
                        : isUpcoming ? 'bg-sky-50 border-sky-200' 
                        : 'bg-white border-gray-200'
                    }`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 mx-auto ${colorClass}`}>
                        <ActivityIcon className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-gray-500 text-center mb-0.5">{activity.crop}</p>
                      <h4 className="font-semibold text-sm text-gray-800 text-center mb-1">
                        {activity.name}
                      </h4>
                      <p className="text-xs text-gray-600 text-center">
                        {formatDate(activity.scheduledDate)}
                      </p>
                      <p className={`text-xs font-medium text-center mt-1 ${
                        isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : isUpcoming ? 'text-sky-600' : 'text-gray-500'
                      }`}>
                        {getDaysFromNow(activity.scheduledDate) > 0 ? `In ${getDaysFromNow(activity.scheduledDate)} days` 
                          : getDaysFromNow(activity.scheduledDate) === 0 ? 'Today' 
                          : `${Math.abs(getDaysFromNow(activity.scheduledDate))} days ago`}
                      </p>
                    </div>
                    {index < upcomingActivities.slice(0, 8).length - 1 && (
                      <div className="flex items-center my-4"><ArrowRight className="w-5 h-5 text-gray-300" /></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend for Upcoming Activities */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Completed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>Overdue</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>Today</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Upcoming (within 7 days)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                <span>Future</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Farming Flowcharts */}
      {state.isAuthenticated ? (
        isLoading ? (
          <div className="card text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-600 mt-4">Loading your farming calendars...</p>
          </div>
        ) : calendars.length > 0 ? (
          <div className="space-y-8">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-green-600" />
              {t('myCropCalendars')}
            </h3>
            {calendars.map((calendar) => {
              const farmingFlow = getFarmingFlowFromCalendar(calendar);
              const pendingFlow = farmingFlow.filter((a: any) => a.status !== 'completed');
              const completedCount = farmingFlow.filter((a: any) => a.status === 'completed').length;
              const totalCount = farmingFlow.length;
              const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
              const harvestActivity = farmingFlow.find((a: any) => a.type === 'harvesting');
              const daysToHarvest = harvestActivity ? getDaysFromNow(harvestActivity.date?.toISOString?.() || harvestActivity.date) : null;
              const maturityDays = calendar.maturityPeriodDays;

              return (
                <div key={calendar.id} className="card border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative">
                  <button
                    type="button"
                    onClick={() => handleDeleteCalendar(calendar.id, calendar.crop || 'this crop')}
                    disabled={deletingId === calendar.id}
                    className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete calendar"
                    aria-label="Delete calendar"
                  >
                    {deletingId === calendar.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                  <div className="mb-6 pr-10">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Sprout className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-gray-800">
                            {calendar.crop || 'Unknown Crop'}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Planted on {formatDate(calendar.plantingDate)}
                          </p>
                          {maturityDays != null && (
                            <p className="text-xs text-green-600 font-medium mt-1">
                              Crop cycle: {maturityDays} days to harvest
                            </p>
                          )}
                        </div>
                      </div>
                      {daysToHarvest != null && (
                        <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                          daysToHarvest < 0 ? 'bg-red-100 text-red-700' 
                            : daysToHarvest <= 7 ? 'bg-amber-100 text-amber-700' 
                            : 'bg-sky-100 text-sky-700'
                        }`}>
                          {daysToHarvest < 0 ? `${Math.abs(daysToHarvest)} days past harvest` 
                            : daysToHarvest === 0 ? 'Harvest today' 
                            : `${daysToHarvest} days to harvest`}
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{completedCount}/{totalCount} activities</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full transition-all duration-500" 
                          style={{ width: `${progressPct}%` }} 
                        />
                      </div>
                    </div>

                    {/* Summary pills */}
                    <div className="flex flex-wrap gap-3 mt-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {completedCount} done
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <Clock className="w-4 h-4" />
                        {farmingFlow.filter((a: any) => a.status !== 'completed' && getDaysFromNow(a.date?.toISOString?.() || a.date) > 0 && getDaysFromNow(a.date?.toISOString?.() || a.date) <= 7).length} upcoming
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-red-600">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        {farmingFlow.filter((a: any) => a.status !== 'completed' && new Date() > new Date(a.date)).length} overdue
                      </span>
                    </div>
                  </div>

                  {/* Timeline flow */}
                  <div className="overflow-x-auto -mx-1">
                    <div className="flex items-start gap-2 min-w-max pb-2">
                      {farmingFlow.map((activity: any, index: number) => (
                        <FlowNode
                          key={activity.id}
                          activity={activity}
                          isLast={index === farmingFlow.length - 1}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Done</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> Today</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400" /> Upcoming (7 days)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Overdue</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-700">Quick actions</p>
                      <button
                        type="button"
                        onClick={() => setAddForCalendarId(addForCalendarId === calendar.id ? null : calendar.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200"
                      >
                        {addForCalendarId === calendar.id ? 'Cancel add' : 'Add activity'}
                      </button>
                    </div>

                    {pendingFlow.slice(0, 3).map((act: any) => (
                      <div key={act.id} className="mt-2 flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{act.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(act.date?.toISOString?.() || act.date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleMarkCompleted(calendar.id, act.id)}
                            disabled={completing === act.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium hover:bg-green-200 disabled:opacity-50"
                          >
                            {completing === act.id ? 'Saving...' : 'Mark complete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(calendar.id, act.id, act.name || 'activity')}
                            disabled={deletingId === act.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 disabled:opacity-50"
                          >
                            {deletingId === act.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}

                    {addForCalendarId === calendar.id && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <select
                          value={newActivity.type}
                          onChange={(e) => setNewActivity((p) => ({ ...p, type: e.target.value }))}
                          className="input-field"
                        >
                          <option value="irrigation">Irrigation</option>
                          <option value="fertilization">Fertilization</option>
                          <option value="pest_control">Pest Control</option>
                          <option value="weeding">Weeding</option>
                          <option value="pruning">Pruning</option>
                          <option value="harvesting">Harvesting</option>
                        </select>
                        <input
                          type="date"
                          value={newActivity.scheduledDate}
                          onChange={(e) => setNewActivity((p) => ({ ...p, scheduledDate: e.target.value }))}
                          className="input-field"
                        />
                        <input
                          type="text"
                          placeholder="Activity name"
                          value={newActivity.name}
                          onChange={(e) => setNewActivity((p) => ({ ...p, name: e.target.value }))}
                          className="input-field md:col-span-2"
                        />
                        <textarea
                          placeholder="Description (optional)"
                          value={newActivity.description}
                          onChange={(e) => setNewActivity((p) => ({ ...p, description: e.target.value }))}
                          className="input-field md:col-span-2 min-h-[70px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddActivity(calendar.id)}
                          className="btn-primary"
                        >
                          Save Activity
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card text-center py-10 border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No calendars yet
              </h3>
              <p className="text-gray-500 mb-4 max-w-sm mx-auto">
                Add a crop and planting date. Each crop gets its own harvest timeline (e.g. 90–120 days).
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                Create Calendar
              </button>
            </div>

            {/* Demo */}
            <div className="card border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">How it works</h3>
              <p className="text-gray-600 mb-6">
                Your calendar shows crop-specific activities and harvest dates. Durations come from crop data and AI when needed.
              </p>
              <div className="overflow-x-auto">
                <div className="flex items-start gap-2 min-w-max pb-4">
                  {[
                    { id: '1', name: 'Planting', type: 'planting', date: new Date(), status: 'completed' },
                    { id: '2', name: 'Irrigation', type: 'irrigation', date: new Date(Date.now() + 3 * 86400000), status: 'pending' },
                    { id: '3', name: 'Fertilizing', type: 'fertilization', date: new Date(Date.now() + 14 * 86400000), status: 'pending' },
                    { id: '4', name: 'Pest check', type: 'pest_control', date: new Date(Date.now() + 28 * 86400000), status: 'pending' },
                    { id: '5', name: 'Harvest', type: 'harvesting', date: new Date(Date.now() + 120 * 86400000), status: 'pending' },
                  ].map((act, index) => (
                    <FlowNode key={act.id} activity={act} isLast={index === 4} />
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Done</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> Today</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400" /> Upcoming</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Overdue</span>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="card text-center py-12">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Login Required
          </h3>
          <p className="text-gray-500">
            Please login to access your farming calendar and track activities.
          </p>
        </div>
      )}
    </div>
  );
}
