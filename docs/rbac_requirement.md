want to implement RBAC based on the specification provided below

1. Six types of users - Super Admin, (company will have two type of users - Company Admin, Company_users), (Agency will have three type of users - Agency Admin, Admin of Agency_Company_admin, Agency_User)
2. Super Admin - the owner of the app, has access to the entire app users, all modules
3. Company Admin - single admin user, can only create one company, multiple projects, can invite many users assign specific projects, ability to add, modify, assign projects, delete a user (archive)
4. Company_users - cannot add, modify, delete Company admin, capability to perform tasks assign on a project by Company admin.
5. Agency Admin - single admin user, can create multiple companies, can create multiple projects, can add, modify, delete (archive), assign company or companies to a admin, user, can assign projects of a company to admin, user, can add or invite user and assign as admin or user
6. Agency_Company_admin - can create multiple companies, can create multiple projects, can add, modify, delete (archive) company, project, Agency_User, cannot add, modify, delete Agency admin, assign company or companies to a user, can assign projects of a company, can add or invite user and assign as user
7. Agency user - cannot add, modify, delete Agency admin, Agency_Company_admin, capability to perform tasks assigned on a project by Agency admin/ Agency_Company_admin.
