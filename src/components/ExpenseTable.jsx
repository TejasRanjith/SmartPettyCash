import { Trash2 } from 'lucide-react'

function ExpenseTable({ expenses, onExpenseChange, onDeleteExpense }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm md:text-base">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <th className="px-3 md:px-4 py-3 text-left font-bold">Date</th>
            <th className="px-3 md:px-4 py-3 text-left font-bold">Receipt No</th>
            <th className="px-3 md:px-4 py-3 text-left font-bold">Description</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold">Amount</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold">Currency</th>
            <th className="px-3 md:px-4 py-3 text-right font-bold">Amount AED</th>
            <th className="px-3 md:px-4 py-3 text-center font-bold">Action</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense, index) => (
            <tr key={expense.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-100'} transition-colors`}>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="date"
                  value={expense.date}
                  onChange={(e) => onExpenseChange(expense.id, 'date', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="text"
                  value={expense.receiptNo}
                  onChange={(e) => onExpenseChange(expense.id, 'receiptNo', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="text"
                  value={expense.description}
                  onChange={(e) => onExpenseChange(expense.id, 'description', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  placeholder="e.g., Fuel for Vehicle"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="number"
                  value={expense.amount}
                  onChange={(e) => onExpenseChange(expense.id, 'amount', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-center"
                  placeholder="0.00"
                  step="0.01"
                />
              </td>
              <td className="px-3 md:px-4 py-3">
                <select
                  value={expense.currency}
                  onChange={(e) => onExpenseChange(expense.id, 'currency', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                >
                  <option>AED</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </td>
              <td className="px-3 md:px-4 py-3">
                <input
                  type="number"
                  value={expense.amountAED}
                  onChange={(e) => onExpenseChange(expense.id, 'amountAED', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-right font-semibold text-blue-600"
                  placeholder="0.00"
                  step="0.01"
                />
              </td>
              <td className="px-3 md:px-4 py-3 text-center">
                <button
                  onClick={() => onDeleteExpense(expense.id)}
                  className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete this expense"
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExpenseTable
