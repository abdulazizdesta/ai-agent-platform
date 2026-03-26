<?php

namespace Database\Seeders;

use Database\Seeders\DepartmentSeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            OrganizationSeeder::class,
            DepartmentSeeder::class,
            SuperAdminSeeder::class,
        ]);
    }
}