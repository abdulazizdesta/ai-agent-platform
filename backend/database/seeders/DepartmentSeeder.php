<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Organization;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    /**
     * Seed default departments for the main organization.
     */
    public function run(): void
    {
        $org = Organization::where('slug', 'lembaga-amil-zakat')->firstOrFail();

        $departments = [
            [
                'name'        => 'Customer Service',
                'description' => 'CS Automation & Support',
            ],
            [
                'name'        => 'Sales',
                'description' => 'Sales & Business Development',
            ],
            [
                'name'        => 'HR',
                'description' => 'Human Resources & People Ops',
            ],
            [
                'name'        => 'Marketing',
                'description' => 'Marketing & Communications',
            ],
        ];

        foreach ($departments as $dept) {
            Department::firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name'            => $dept['name'],
                ],
                [
                    'organization_id' => $org->id,
                    'name'            => $dept['name'],
                    'description'     => $dept['description'],
                    'is_active'       => true,
                ]
            );
        }

        $this->command->info('✅ Departments seeded: CS, Sales, HR, Marketing');
    }
}