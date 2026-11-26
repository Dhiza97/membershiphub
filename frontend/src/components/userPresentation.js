export function displayName(user) {
	return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
}

export function roleName(role) {
	if (role === 'SUPER_ADMIN') return 'Super Admin'
	if (role === 'INSTRUCTOR') return 'Instructor'
	if (role === 'STUDENT') return 'Student'
	return 'Branch Admin'
}