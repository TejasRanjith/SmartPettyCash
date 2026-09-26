function ExpenseForm({ formData, onFormChange }) {
  // Prevent number keypresses directly
  const handleTextOnlyKeyDown = (e) => {
    // Block numeric keys (0-9 and numpad 0-9)
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      ((e.key >= '0' && e.key <= '9') || (e.code && e.code.startsWith('Numpad') && !isNaN(e.key)))
    ) {
      e.preventDefault();
    }
  };

  const handleTextOnlyChange = (e) => {
    const { name, value } = e.target;
    // Strip any numeric characters (in case of paste or autofill)
    const textOnlyValue = value.replace(/[0-9]/g, '');
    onFormChange({
      target: {
        name,
        value: textOnlyValue
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Name <span className="text-xs text-gray-400 font-normal">(Text only)</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleTextOnlyChange}
          onKeyDown={handleTextOnlyKeyDown}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          placeholder="Enter employee name"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={onFormChange}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Location <span className="text-xs text-gray-400 font-normal">(Text only)</span>
        </label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleTextOnlyChange}
          onKeyDown={handleTextOnlyKeyDown}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          placeholder="e.g., ABU DHABI"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Title / Position <span className="text-xs text-gray-400 font-normal">(Designation, text only)</span>
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleTextOnlyChange}
          onKeyDown={handleTextOnlyKeyDown}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          placeholder="e.g., ACCOUNT MANAGER"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Expense Title</label>
        <input
          type="text"
          name="expenseTitle"
          value={formData.expenseTitle}
          onChange={onFormChange}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          placeholder="e.g., May 2026 EXPENSES"
        />
      </div>
    </div>
  )
}

export default ExpenseForm
