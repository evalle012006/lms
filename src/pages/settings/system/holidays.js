import React, { useEffect, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import Spinner from '@/components/Spinner';
import { setHolidayList } from '@/redux/actions/holidayActions';
import { getApiBaseUrl } from '@/lib/constants';
import moment from 'moment';
import { Formik } from 'formik';
import * as yup from 'yup';
import {
  PlusIcon,
  CalendarDaysIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const ModernInput = ({ 
  name, 
  value, 
  label, 
  placeholder, 
  icon: Icon, 
  type = "text",
  required = false,
  onChange,
  setFieldValue,
  errors 
}) => (
  <div className="group">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Icon className={`h-5 w-5 transition-colors ${
          errors ? 'text-red-400' : 'text-gray-400 group-focus-within:text-blue-500'
        }`} />
      </div>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:shadow-lg ${
          errors 
            ? 'border-red-300 focus:ring-red-500' 
            : 'border-gray-200 focus:ring-blue-500'
        }`}
      />
    </div>
    {errors && <span className="text-red-400 text-xs font-medium mt-1 block">{errors}</span>}
  </div>
);

const HolidayCard = ({ holiday, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
    <div className="flex items-start justify-between">
      <div className="flex items-start space-x-4">
        <div className="bg-blue-100 rounded-lg p-3">
          <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{holiday.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{holiday.description}</p>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {holiday.dateStr || moment(holiday.date).format('MMMM DD')}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onEdit(holiday)}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(holiday)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
);

const AddEditModal = ({ isOpen, onClose, holiday, onSave, mode }) => {
  const validationSchema = yup.object().shape({
    name: yup.string().required('Holiday name is required'),
    description: yup.string().required('Description is required'),
    date: yup.date().required('Date is required')
  });

  const initialValues = {
    name: holiday?.name || '',
    description: holiday?.description || '',
    date: holiday?.date ? moment(holiday.date).format('YYYY-MM-DD') : ''
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {mode === 'add' ? 'Add Holiday' : 'Edit Holiday'}
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={onSave}
          enableReinitialize
        >
          {({ values, errors, touched, handleChange, handleSubmit, setFieldValue }) => (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <ModernInput
                name="name"
                value={values.name}
                label="Holiday Name"
                placeholder="Enter holiday name"
                icon={CalendarDaysIcon}
                onChange={handleChange}
                setFieldValue={setFieldValue}
                errors={touched.name && errors.name}
                required
              />
              
              <ModernInput
                name="description"
                value={values.description}
                label="Description"
                placeholder="Enter holiday description"
                icon={CalendarDaysIcon}
                onChange={handleChange}
                setFieldValue={setFieldValue}
                errors={touched.description && errors.description}
                required
              />
              
              <ModernInput
                name="date"
                value={values.date}
                label="Date"
                placeholder="Select date"
                icon={CalendarDaysIcon}
                type="date"
                onChange={handleChange}
                setFieldValue={setFieldValue}
                errors={touched.date && errors.date}
                required
              />
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                >
                  {mode === 'add' ? 'Add Holiday' : 'Update Holiday'}
                </button>
              </div>
            </form>
          )}
        </Formik>
      </div>
    </div>
  );
};

const DeleteModal = ({ isOpen, onClose, holiday, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Holiday</h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            Are you sure you want to delete "{holiday?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility function to create safe holiday objects
const createSafeHoliday = (holiday, index) => {
  try {
    const currentYear = moment().year();
    const holidayDate = holiday.date || '';
    const tempDate = holidayDate ? `${currentYear}-${holidayDate}` : '';
    
    return Object.freeze({
      _id: holiday._id || `holiday-${index}-${Date.now()}`,
      name: String(holiday.name || ''),
      description: String(holiday.description || ''),
      date: String(holidayDate),
      dateStr: holiday.dateStr || (holidayDate && moment(tempDate).isValid() 
        ? moment(tempDate).format('MMMM DD') 
        : 'Invalid Date'),
      dateAdded: holiday.dateAdded || null
    });
  } catch (error) {
    console.warn(`Error processing holiday at index ${index}:`, error);
    return Object.freeze({
      _id: `holiday-error-${index}-${Date.now()}`,
      name: 'Error Loading Holiday',
      description: 'There was an error loading this holiday',
      date: '',
      dateStr: 'Invalid Date',
      dateAdded: null
    });
  }
};

const HolidaysSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const reduxHolidays = useSelector(state => state.holidays.list) || [];
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [mode, setMode] = useState('add');
    const [selectedHoliday, setSelectedHoliday] = useState(null);
    const [saved, setSaved] = useState(false);

    // Create safe immutable copy of Redux holidays for display
    const safeHolidays = reduxHolidays.map((holiday, index) => createSafeHoliday(holiday, index));

    const refreshHolidayList = async () => {
        try {
            let url = getApiBaseUrl() + 'settings/holidays/list';
            const response = await fetchWrapper.get(url);
            if (response.success && response.holidays) {
                // Create completely safe immutable objects
                const holidays = response.holidays.map((holiday, index) => 
                    createSafeHoliday(holiday, index)
                );
                
                // Dispatch with a completely new array reference
                dispatch(setHolidayList(Object.freeze([...holidays])));
            } else if (response.error) {
                toast.error(response.message);
            }
        } catch (error) {
            console.error('Error fetching holidays:', error);
            toast.error('Failed to fetch holidays');
        }
    };

    const handleShowAddModal = () => {
        setMode('add');
        setSelectedHoliday(null);
        setShowModal(true);
    };

    const handleEditHoliday = (holiday) => {
        setMode('edit');
        setSelectedHoliday(holiday);
        setShowModal(true);
    };

    const handleDeleteHoliday = (holiday) => {
        setSelectedHoliday(holiday);
        setShowDeleteModal(true);
    };

    const handleSaveHoliday = async (values) => {
        setLoading(true);
        try {
            let apiURL, payload;
            
            if (mode === 'add') {
                apiURL = `${getApiBaseUrl()}settings/holidays/save`;
                payload = values;
            } else {
                apiURL = `${getApiBaseUrl()}settings/holidays`;
                payload = { ...values, _id: selectedHoliday._id };
            }

            const response = await fetchWrapper.post(apiURL, payload);

            if (response.success) {
                toast.success(`Holiday ${mode === 'add' ? 'added' : 'updated'} successfully!`);
                setShowModal(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                // Refresh the list without loading state
                await refreshHolidayList();
            } else if (response.error) {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error(`Failed to ${mode} holiday`);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        setLoading(true);
        try {
            const response = await fetchWrapper.postCors(
                `${getApiBaseUrl()}settings/holidays/delete`, 
                selectedHoliday
            );

            if (response.success) {
                toast.success('Holiday deleted successfully!');
                setShowDeleteModal(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                // Refresh the list without loading state
                await refreshHolidayList();
            } else if (response.error) {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error('Failed to delete holiday');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser.role && currentUser.role.rep > 2) {
            router.push('/');
        }
    }, []);

    const sortedHolidays = [...safeHolidays].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Holiday Management</h1>
                            <p className="text-sm text-gray-600 mt-1">Manage company holidays and non-working days</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            {saved && (
                                <div className="flex items-center px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                                    <span className="text-sm font-medium">Changes saved!</span>
                                </div>
                            )}
                            <button
                                onClick={handleShowAddModal}
                                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Add Holiday
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="bg-blue-100 rounded-lg p-3 mr-4">
                                        <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total Holidays</p>
                                        <p className="text-2xl font-bold text-gray-900">{safeHolidays.length}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="bg-green-100 rounded-lg p-3 mr-4">
                                        <CalendarDaysIcon className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">This Year</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {safeHolidays.filter(h => {
                                                if (!h.date) return false;
                                                const currentYear = moment().year();
                                                const holidayDate = currentYear + '-' + h.date;
                                                return moment(holidayDate).year() === currentYear;
                                            }).length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="bg-purple-100 rounded-lg p-3 mr-4">
                                        <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Upcoming</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {safeHolidays.filter(h => {
                                                if (!h.date) return false;
                                                const currentYear = moment().year();
                                                const holidayDate = currentYear + '-' + h.date;
                                                return moment(holidayDate).isAfter(moment());
                                            }).length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Holiday Cards */}
                        {safeHolidays.length === 0 ? (
                            <div className="text-center py-12">
                                <CalendarDaysIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No holidays configured</h3>
                                <p className="text-gray-600 mb-4">Get started by adding your first holiday.</p>
                                <button
                                    onClick={handleShowAddModal}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <PlusIcon className="h-5 w-5 mr-2" />
                                    Add Holiday
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sortedHolidays.map((holiday) => (
                                    <HolidayCard
                                        key={holiday._id}
                                        holiday={holiday}
                                        onEdit={handleEditHoliday}
                                        onDelete={handleDeleteHoliday}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            <AddEditModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                holiday={selectedHoliday}
                onSave={handleSaveHoliday}
                mode={mode}
            />

            <DeleteModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                holiday={selectedHoliday}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}

export default HolidaysSettingsPage;