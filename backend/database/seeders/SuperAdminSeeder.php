<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Seed the first superadmin user.
     */
    public function run(): void
    {
        $org  = Organization::where('slug', 'lembaga-amil-zakat')->firstOrFail();
        $dept = Department::where('organization_id', $org->id)
                          ->where('name', 'Customer Service')
                          ->first();

        User::firstOrCreate(
            ['username' => 'superadmin'],
            [
                'name'            => 'Super Admin',
                'username'        => 'superadmin',
                'employee_id'     => 'EMP-0001',
                'email'           => 'admin@nurulhayat.org',
                'phone'           => null,
                'city'            => null,
                'password'        => Hash::make('password'),
                'organization_id' => $org->id,
                'department_id'   => $dept?->id,
                'role'            => 'superadmin',
                'status'          => 'approved',
            ]
        );

        $this->command->info('✅ Super Admin seeded');
        $this->command->info('   Username : superadmin');
        $this->command->info('   Password : password');
        $this->command->info('   ⚠️  Ganti password setelah login pertama!');
    }
}