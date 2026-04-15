#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
ext_group = project.main_group.groups.find { |g| g.name == 'SwiftSafariExtension' }

# Add Resources as a folder reference inside the extension group
ref = ext_group.new_reference('Resources')
ref.last_known_file_type = 'folder'
ref.source_tree = '<group>'
ext_target.resources_build_phase.add_file_reference(ref)

project.save

puts "Resources: #{ext_target.resources_build_phase.files.count}"
ext_target.resources_build_phase.files.each { |f| puts "  - #{f.file_ref&.display_name} (#{f.file_ref&.path})" }
