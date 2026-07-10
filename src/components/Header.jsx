function Header() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-lg p-8 text-center text-white">
      <img src="/image.png" alt="Company Logo" className="mx-auto object-contain mb-4" style={{ width: '384px', maxHeight: '288px' }} />
      <h2 className="text-3xl md:text-4xl font-bold mt-2">Expense Reimbursement Form</h2>
      <p className="text-blue-100 mt-2">Manage and track your business expenses efficiently</p>
    </div>
  )
}

export default Header
